import DownloadIcon from '@sourcegraph/icons/lib/Download'
import LoaderIcon from '@sourcegraph/icons/lib/Loader'
import PackageIcon from '@sourcegraph/icons/lib/Package'
import upperFirst from 'lodash/upperFirst'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Observable } from 'rxjs/Observable'
import { merge } from 'rxjs/observable/merge'
import { of } from 'rxjs/observable/of'
import { catchError } from 'rxjs/operators/catchError'
import { delay } from 'rxjs/operators/delay'
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged'
import { map } from 'rxjs/operators/map'
import { switchMap } from 'rxjs/operators/switchMap'
import { takeUntil } from 'rxjs/operators/takeUntil'
import { tap } from 'rxjs/operators/tap'
import { Subject } from 'rxjs/Subject'
import { Subscription } from 'rxjs/Subscription'
import { gql, queryGraphQL } from '../../backend/graphql'
import { OverviewItem, OverviewList } from '../../components/Overview'
import { PageTitle } from '../../components/PageTitle'
import { eventLogger } from '../../tracking/eventLogger'
import { createAggregateError, ErrorLike, isErrorLike } from '../../util/errors'
import { pluralize } from '../../util/strings'

interface Props extends RouteComponentProps<{}> {
    repo: GQL.IRepository
    commitID: string
    routePrefix: string
}

interface OverviewInfo {
    packages: number
    dependencies: number
}

interface State {
    /**
     * The fetched overview, or an error (if an error occurred). `undefined` while loading.
     */
    overviewOrError?: OverviewInfo | ErrorLike

    /**
     * Whether to show the loading icon. It is not shown unless loading takes a more than a few hundred msec, to
     * avoid visual jitter.
     */
    loading: boolean
}

/**
 * The repository graph overview page.
 */
export class RepositoryGraphOverviewPage extends React.PureComponent<Props, State> {
    public state: State = { loading: false }

    private componentUpdates = new Subject<Props>()
    private subscriptions = new Subscription()

    public componentDidMount(): void {
        eventLogger.logViewEvent('RepoGraphOverview')

        this.subscriptions.add(
            this.componentUpdates
                .pipe(
                    distinctUntilChanged((a, b) => a.repo.id === b.repo.id && a.commitID === b.commitID),
                    tap(() => this.setState({ overviewOrError: undefined })),
                    switchMap(({ repo, commitID }) => {
                        type PartialStateUpdate = Pick<State, 'overviewOrError' | 'loading'>
                        const result = this.fetchOverview(repo.id, commitID).pipe(
                            catchError(error => [error]),
                            map(c => ({ overviewOrError: c, loading: false } as PartialStateUpdate))
                        )
                        return merge(result, of({ loading: true }).pipe(delay(250), takeUntil(result)))
                    })
                )
                .subscribe(stateUpdate => this.setState(stateUpdate), error => console.error(error))
        )
        this.componentUpdates.next(this.props)
    }

    public componentWillUpdate(nextProps: Props): void {
        if (nextProps.repo !== this.props.repo || nextProps.commitID !== this.props.commitID) {
            this.componentUpdates.next(nextProps)
        }
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        return (
            <div className="repository-graph-page repository-graph-overview-page">
                <PageTitle title="Overview - Repository graph" />
                {isErrorLike(this.state.overviewOrError) && (
                    <div className="alert alert-danger">{upperFirst(this.state.overviewOrError.message)}</div>
                )}
                {!isErrorLike(this.state.overviewOrError) && (
                    <OverviewList>
                        <OverviewItem link={`${this.props.routePrefix}/-/graph/packages`} icon={PackageIcon}>
                            {this.state.overviewOrError === undefined ? (
                                this.state.loading && (
                                    <>
                                        <LoaderIcon className="icon-inline" /> Packages
                                    </>
                                )
                            ) : (
                                <>
                                    {this.state.overviewOrError.packages}&nbsp;{pluralize(
                                        'package',
                                        this.state.overviewOrError.packages
                                    )}
                                </>
                            )}
                        </OverviewItem>
                        <OverviewItem link={`${this.props.routePrefix}/-/graph/dependencies`} icon={DownloadIcon}>
                            {this.state.overviewOrError === undefined ? (
                                this.state.loading && (
                                    <>
                                        <LoaderIcon className="icon-inline" /> Dependencies
                                    </>
                                )
                            ) : (
                                <>
                                    {this.state.overviewOrError.dependencies}&nbsp;{pluralize(
                                        'dependency',
                                        this.state.overviewOrError.dependencies,
                                        'dependencies'
                                    )}
                                </>
                            )}
                        </OverviewItem>
                    </OverviewList>
                )}
            </div>
        )
    }

    private fetchOverview(repo: GQLID, commitID: string): Observable<OverviewInfo> {
        return queryGraphQL(
            gql`
                query RepositoryGraphOverview($repo: ID!, $commitID: String!) {
                    node(id: $repo) {
                        ... on Repository {
                            commit(rev: $commitID) {
                                packages {
                                    totalCount
                                }
                                dependencies {
                                    totalCount
                                }
                            }
                        }
                    }
                }
            `,
            { repo, commitID }
        ).pipe(
            map(({ data, errors }) => {
                if (!data || !data.node) {
                    throw createAggregateError(errors)
                }
                const repo = data.node as GQL.IRepository
                if (
                    !repo.commit ||
                    !repo.commit.packages ||
                    typeof repo.commit.packages.totalCount !== 'number' ||
                    !repo.commit.dependencies ||
                    typeof repo.commit.dependencies.totalCount !== 'number'
                ) {
                    throw createAggregateError(errors)
                }
                return { packages: repo.commit.packages.totalCount, dependencies: repo.commit.dependencies.totalCount }
            })
        )
    }
}
