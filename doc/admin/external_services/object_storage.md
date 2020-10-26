# Using a managed object storage service (S3 or GCS)

By default, Sourcegraph will use a MinIO server bundled with the instance to store precise code intelligence indexes uploaded by users. You can configure your instance to instead store this data in an S3 or GCS bucket. Doing so may decrease your hosting costs as persistent volumes are often more expensive than the same storage space in an object store service.

To target a managed object storage service, you will need to set a handful of environment variables for configuration and authentication to the target service. If you are running a sourcegraph/server deployment, set the environment variables on the server container. Otherwise, if running via Docker or Kubernetes, set the environment variables on the `frontend` and `precise-code-intel-worker` containers.

### Using S3

To target an S3 bucket, set the environment variable `PRECISE_CODE_INTEL_UPLOAD_BACKEND` to `S3` and the environment variable `PRECISE_CODE_INTEL_UPLOAD_BUCKET` to the name of the target bucket in your AWS account. The environment variable `AWS_REGION` can be used to specify a particular AWS region.

To authenticate, you must either supply an access key pair via the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, or volume mount a shared credentials file into the container and indicate its path with the environment variable `AWS_SHARED_CREDENTIALS_FILE`. The profile in the shared credentials file indicated by environment variable `AWS_PROFILE` will be used. 

The environment variables `AWS_ENDPOINT` and `AWS_S3_FORCE_PATH_STYLE` are supplied by default to target a MinIO server and should be **unset**.

### Using GCS

To target a GCS bucket, set the environment variable `PRECISE_CODE_INTEL_UPLOAD_BACKEND` to `GCS` and the environment variable `PRECISE_CODE_INTEL_UPLOAD_BUCKET` to the name of the target bucket in your GCP account. The environment variable `PRECISE_CODE_INTEL_UPLOAD_GCP_PROJECT_ID` indicates the identifier of the project containing the target bucket.

To authenticate, you must either volume mount a credentials file into the container and indicate its path with the environment variable `GOOGLE_APPLICATION_CREDENTIALS`, or supply the _contents_ of such a file with the environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON.

### Provisioning buckets

By default, Sourcegraph will attempt to create and manage the configuration of the target bucket. If you would like to provision the bucket externally (e.g. via Cloudformation or Terraform), you should set the environment variable `PRECISE_CODE_INTEL_UPLOAD_MANAGE_BUCKET` to false to skip the bucket configuration checks. If Sourcegraph manages the bucket, you can control the age before expiration of the objects within the bucket with the environment variable `PRECISE_CODE_INTEL_UPLOAD_TTL`. By default the TTL is one week.
