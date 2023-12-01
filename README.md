# Bobcat Redirects Sampler

This is a hastily created [bobcat\-redirects](https://github.com/NYULibraries/bobcat-redirects)
sampler based on [openurl\-link\-resolver\-sampler](https://github.com/NYULibraries/openurl-link-resolver-sampler).
Technically it is possible to run the sampler against multiple instances of [bobcat\-redirects](https://github.com/NYULibraries/bobcat-redirects),
but at the moment only one service sampler is defined: `BobcatRedirectsServiceSampler`.

This sampler has not been productionized, or even significantly tested (the same is largely
true of [openurl\-link\-resolver\-sampler](https://github.com/NYULibraries/openurl-link-resolver-sampler)
as well).
Use at your own risk!

Motivation: see monday.com ticket
[Test all LibGuides bobcat links against bobcat\-redirects](https://nyu-lib.monday.com/boards/765008773/pulses/5603151493).

# Usage

For the basic usage message, run `main.js --help`:

```shell
$ node main.js --help
Usage: main.js [-b|bobcat-redirects-endpoint <Bobcat Redirects endpoint>] [-x|--
excude <service name> [--headed] [-l|--limit <number>] [-r|--replace] <libguides>

Options:
      --help                       Show help                           [boolean]
      --version                    Show version number                 [boolean]
  -b, --bobcat-redirects-endpoint  Override Bobcat Redirects endpoint   [string]
      --headed                     Run playwright in "headed" mode     [boolean]
      --limit                      Set the number of samples to fetch   [number]
  -r, --replace                    Replace existing sample files       [boolean]
  -t, --timeout                    Set Playwright timeout               [number]
```

## Examples:

Retrieve samples for all test paths in the *.txt files in _test-case-files/libguides.txt/_,
saving them in _response-samples/libguides/_ and adding appropriate entries to
_response-samples/libguides/index.json_.  The _libguides/_ subdirectory and the _index.json_
file will be created automatically if they do not already exist.
By default, the sample runs in "resume" mode, meaning it will not retrieve samples
for test paths that already have entries in _index.json_.

```shell
node main.js libguides
```

To retrieve samples for all test paths regardless of whether they've already been
retrieved (according to _response-samples/libguides/index.json_), add the `--replace`
flag.  The previous sample files and index entries will be overwritten.

```shell
node main.js --replace libguides
```

To make the Chromium browser used by `playwright` visible, add the `--headed` flag.

```shell
node main.js --headed libguides
```

To override the default timeout of 300,000 milliseconds (5 minutes/300 seconds),
add the `--timeout` flag with new timeout in milliseconds.

```shell
node main.js --timeout 5000 libguides
```

The command below will override the default Bobcat Redirects endpoint, run `playwright` in
"headed" mode, retrieve a sample for every test URL in _libguides/libguides.txt_
regardless of whether an entry already exists in _response-samples/libguides/index.json_
or not, and override the default timeout (in milliseconds):

```shell
node main.js --bobcat-redirects-endpoint https://persistent-dev.library.nyu.edu/bobcat --headed --replace --timeout 30000 libguides
```

To exclude the service [SERVICE NAME] from the sampling:

```shell
node main.js --exclude [SERVICE NAME] --replace libguides
```

The argument to the `--exclude` option is the value of the `.serviceName` field for the service sampler
that is to be excluded.  The service sampler classes are in _lib/classes/_.
Multiple `--exclude` flags are permitted for excluding more than one service.

Note that currently there is only one service defined, `bobcat-redirects`
(`BobcatRedirectsServiceSampler`), so there isn't a reason to use this option yet.
Later, if there is a desire to sample multiple instances of
[bobcat\-redirects](https://github.com/NYULibraries/bobcat-redirects), new services can be defined.

# Creating new test case groups

To make a new test case group, create a new subdirectory in _test-case-files/_
containing *.txt files that have lists of test case paths of the proper form, one per line.
See the _libguides/_ directory for examples.
Test case paths must start with "https://bobcat.library.nyu.edu/permalink".

The new subdirectory name will automatically be added to the list of valid test
case groups that can be accepted as an argument (and so will appear in usage and
error messages).  As new subdirectory of the same name will be created in the _response-samples/_
directory when the sample run is executed.

# Response samples

Response samples of interest are being stored in a separate repo: [bobcat\-redirects\-response\-samples](https://github.com/NYULibraries/bobcat-redirects-response-samples).

## Test cases

monday.com ticket: [Test all LibGuides bobcat links against bobcat\-redirects](https://nyu-lib.monday.com/boards/765008773/pulses/5603151493).

