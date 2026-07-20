"""Direct SQL access for the safety suites.

WHY THIS EXISTS
---------------
Two suites reach past the API to set up state the API deliberately will not let
them set — chiefly ageing a delivered session so the dose engine sees a real
inter-treatment gap. That is legitimate: there is no endpoint for "pretend three
weeks passed", and the gap rules are the most safety-critical branch in the
engine.

But both suites did it with a hardcoded

    docker exec -i healthos-db psql -U healthos -d healthos ...

and `capture_output=True` with no return-code check. That has two failure modes,
and both are silent:

1. WRONG DATABASE. The container name is fixed, so the SQL lands in whatever
   `healthos-db` happens to be — even when the API under test is pointed at a
   different database entirely. The suite then asserts against a course the
   ageing never touched.

2. NO DATABASE. Anywhere without that container (CI, a colleague's machine,
   Postgres run natively) the command fails, the failure is swallowed, and
   `age_last_session` becomes a no-op. The gap tests then "pass" by asserting
   the engine's on-schedule behaviour against a table of gap expectations —
   a tautology wearing a safety test's clothes.

Failure mode 2 is the dangerous one. A safety check that cannot fail is worse
than no check, because it is counted as coverage.

So: resolve the connection from the same environment the app uses, and RAISE on
any failure. A setup step that did not happen must stop the suite, not quietly
weaken it.
"""
import os
import shutil
import subprocess
import urllib.parse

_NOTED = []

# libpq accepts only its own keywords in a connection URI and ERRORS on anything
# else — it does not ignore unknown parameters. Prisma's URLs routinely carry
# params that are Prisma's alone (`schema`, connection-pool tuning), so handing
# DATABASE_URL to psql unmodified fails with:
#
#     psql: error: invalid URI query parameter: "schema"
#
# which is exactly what broke the first CI run. Whitelist rather than blacklist:
# a new Prisma-only parameter appearing in a URL must not become a new outage.
_LIBPQ_PARAMS = {
    'application_name', 'channel_binding', 'client_encoding', 'connect_timeout',
    'fallback_application_name', 'gssencmode', 'gsslib', 'krbsrvname', 'options',
    'passfile', 'requirepeer', 'service', 'sslcert', 'sslcompression', 'sslcrl',
    'sslcrldir', 'sslkey', 'sslmode', 'sslpassword', 'sslrootcert', 'sslsni',
    'target_session_attrs', 'tcp_user_timeout',
}


def _psql_url(url):
    """(libpq-safe URL, extra env) from a Prisma connection string.

    `?schema=X` is Prisma's spelling of a search_path, so it is translated
    rather than discarded — dropping it silently would point the SQL at
    whatever search_path the role happens to default to, which is the same
    class of quiet wrong-target bug this module exists to prevent.
    """
    parts = urllib.parse.urlsplit(url)
    kept, schema = [], None
    for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True):
        if k == 'schema':
            schema = v
        elif k in _LIBPQ_PARAMS:
            kept.append((k, v))
        # anything else is Prisma-only (connection_limit, pool_timeout,
        # pgbouncer, ...) and would be a hard error to libpq.
    safe = urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(kept), parts.fragment))
    env = None
    if schema:
        env = dict(os.environ)
        env['PGOPTIONS'] = ('%s -c search_path=%s' % (env.get('PGOPTIONS', ''), schema)).strip()
    return safe, env


def _conn():
    """(kind, argv-prefix) for reaching the database the API is using.

    Prefers a real connection string, because that is what the app itself
    reads — if psql and the app disagree about which database this is, the
    suite is testing nothing. The docker fallback exists only so local dev
    keeps working on machines with no psql client installed.
    """
    url = os.environ.get('DIRECT_DATABASE_URL') or os.environ.get('DATABASE_URL')
    exe = shutil.which('psql')
    if url and exe:
        safe, env = _psql_url(url)
        return 'url', [exe, safe], env
    container = os.environ.get('HEALTHOS_DB_CONTAINER', 'healthos-db')
    if shutil.which('docker'):
        if not _NOTED:
            _NOTED.append(1)
            # Say so out loud. A mismatch between this container and the
            # database the API is on produced exactly the silent-wrong-DB
            # failure this module exists to prevent.
            print('  [db] no psql client on PATH — using container %r. '
                  'If the API is NOT on that database, these results are meaningless.'
                  % container)
        return 'docker', ['docker', 'exec', '-i', container,
                          'psql', '-U', 'healthos', '-d', 'healthos'], None
    raise SystemExit(
        'cannot reach the database: set DIRECT_DATABASE_URL and install a psql '
        'client, or run the dev Postgres container.')


def psql(sql, quiet_columns=True):
    """Run one statement. Returns stripped stdout. Raises if it did not run.

    ON_ERROR_STOP so a bad statement is a non-zero exit rather than a warning
    printed into a stdout nobody reads.
    """
    kind, prefix, env = _conn()
    argv = prefix + ['-v', 'ON_ERROR_STOP=1', '-q']
    if quiet_columns:
        argv += ['-t']
    argv += ['-c', sql]
    r = subprocess.run(argv, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        raise SystemExit(
            'SQL setup failed (%s) — refusing to continue, because a silent no-op '
            'here turns the checks that follow into tautologies.\n'
            '  sql: %s\n  err: %s' % (kind, sql[:200], (r.stderr or '').strip()[:400]))
    return (r.stdout or '').strip()
