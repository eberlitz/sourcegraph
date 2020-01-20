import { saveScreenshotsUponFailures } from '../../../shared/src/e2e/screenshotReporter'
import { createDriverForTest, Driver } from '../../../shared/src/e2e/driver'
import { ExternalServiceKind } from '../../../shared/src/graphql/schema'
import { testSingleFilePage } from './shared'
import { getConfig } from '../../../shared/src/e2e/config'

const GHE_BASE_URL = process.env.GHE_BASE_URL || 'https://ghe.sgdev.org'
const GHE_USERNAME = process.env.GHE_USERNAME
if (!GHE_USERNAME) {
    throw new Error('GHE_USERNAME environment variable must be set')
}
const GHE_PASSWORD = process.env.GHE_PASSWORD
if (!GHE_PASSWORD) {
    throw new Error('GHE_PASSWORD environment variable must be set')
}
const GHE_TOKEN = process.env.GHE_TOKEN
if (!GHE_TOKEN) {
    throw new Error('GHE_TOKEN environment variable must be set')
}

const REPO_PREFIX = new URL(GHE_BASE_URL).hostname

const { sourcegraphBaseUrl } = getConfig('sourcegraphBaseUrl')

/**
 * Logs into GitHub Enterprise enterprise.
 */
async function gheLogin(driver: Driver): Promise<void> {
    await driver.goto(GHE_BASE_URL)
    if (new URL(driver.page.url()).pathname.endsWith('/login')) {
        await driver.page.type('#login_field', GHE_USERNAME!)
        await driver.page.type('#password', GHE_PASSWORD!)
        await Promise.all([driver.page.click('input[name=commit]'), driver.page.waitForNavigation()])
    }
}

/**
 * Runs initial setup for the GitHub Enterprise instance.
 *
 */
async function init(driver: Driver): Promise<void> {
    await driver.ensureLoggedIn({ username: 'test', password: 'test', email: 'test@test.com' })
    await gheLogin(driver)
    await driver.setExtensionSourcegraphUrl()
    await driver.ensureHasExternalService({
        kind: ExternalServiceKind.GITHUB,
        displayName: 'GitHub Enterprise (e2e)',
        config: JSON.stringify({
            url: GHE_BASE_URL,
            token: GHE_TOKEN,
            repos: ['sourcegraph/jsonrpc2'],
        }),
        ensureRepos: [`${REPO_PREFIX}/sourcegraph/jsonrpc2`],
    })
    // GHE doesn't allow cloning public repos through the UI (only GitHub.com has the GitHub importer).
    // These tests expect that sourcegraph/jsonrpc2 is cloned on the GHE instance.
    await driver.goto(`${GHE_BASE_URL}/sourcegraph/jsonrpc2`)
    if (await driver.page.evaluate(() => document.querySelector('#not-found-search') !== null)) {
        throw new Error('You must clone sourcegraph/jsonrpc2 to your GHE instance to run these tests')
    }
}

describe('Sourcegraph browser extension on GitHub Enterprise', () => {
    let driver: Driver

    before(async function() {
        this.timeout(4 * 60 * 1000)
        driver = await createDriverForTest({ loadExtension: true, sourcegraphBaseUrl })
        await init(driver)
    })

    after(async () => {
        await driver.close()
    })

    // Take a screenshot when a test fails.
    saveScreenshotsUponFailures(() => driver.page)

    testSingleFilePage({
        getDriver: () => driver,
        url: `${GHE_BASE_URL}/sourcegraph/jsonrpc2/blob/4fb7cd90793ee6ab445f466b900e6bffb9b63d78/call_opt.go`,
        repoName: `${REPO_PREFIX}/sourcegraph/jsonrpc2`,
        sourcegraphBaseUrl,
        // Not using '.js-file-line' because it breaks the reliance on :nth-child() in testSingleFilePage()
        lineSelector: '.js-file-line-container tr',
        goToDefinitionURL: `${GHE_BASE_URL}/sourcegraph/jsonrpc2/blob/4fb7cd90793ee6ab445f466b900e6bffb9b63d78/call_opt.go#L5:6`,
    })
})
