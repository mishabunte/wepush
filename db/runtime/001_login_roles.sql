\set ON_ERROR_STOP on

SELECT format(
  'CREATE ROLE wepush_web LOGIN PASSWORD %L',
  :'web_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wepush_web')
\gexec

ALTER ROLE wepush_web LOGIN PASSWORD :'web_password';
GRANT marketplace_web TO wepush_web;
ALTER ROLE wepush_web SET statement_timeout = '5s';
ALTER ROLE wepush_web SET idle_in_transaction_session_timeout = '5s';

SELECT format(
  'CREATE ROLE wepush_worker LOGIN PASSWORD %L',
  :'worker_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wepush_worker')
\gexec

ALTER ROLE wepush_worker LOGIN PASSWORD :'worker_password';
GRANT marketplace_worker TO wepush_worker;
ALTER ROLE wepush_worker SET statement_timeout = '30s';
ALTER ROLE wepush_worker SET idle_in_transaction_session_timeout = '5s';

SELECT format(
  'CREATE ROLE wepush_admin LOGIN PASSWORD %L',
  :'admin_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wepush_admin')
\gexec

ALTER ROLE wepush_admin LOGIN PASSWORD :'admin_password';
GRANT marketplace_admin TO wepush_admin;
ALTER ROLE wepush_admin SET statement_timeout = '30s';
ALTER ROLE wepush_admin SET idle_in_transaction_session_timeout = '5s';
