# opencollective-jobs

[![Greenkeeper badge](https://badges.greenkeeper.io/opencollective/opencollective-jobs.svg)](https://greenkeeper.io/)

> some microservices and views into them

## Env Vars

You'll need to set one of the following sets of environment variables if you want to be authenticated with the GitHub API:

- `GITHUB_OAUTH_TOKEN` (personal access token; **this is the preferred method**)
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (for machine-to-machine communication)
- `GITHUB_USERNAME` and `GITHUB_PASSWORD` (basic auth; will not work with 2FA enabled)

If you aren't authenticated, you cannot access private data, and will be severely rate-limited. 

## CLI

There's a CLI to grab some data, which dumps JSON.

```
ghorg [options] <command>

Commands:
  contrib <org..>  Gather contribution statistics for one or more GitHub orgs.

Options:
  --loglevel  Choose level of log output (to STDERR)
       [string] [choices: "debug", "verbose", "info", "warn", "error"] [default:
                                                                         "info"]
  --quiet     Suppress all logging output             [boolean] [default: false]
  --version   Show version number                                      [boolean]
  --help      Show help                                                [boolean]
```

To write to file, just do:

```shell
$ ghorg contrib myOrg > contrib-data.json
```
