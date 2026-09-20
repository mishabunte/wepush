CREATE FUNCTION api.admin_recent_events(p_limit integer DEFAULT 100)
RETURNS TABLE(event_id bigint, event_type text, entity_type text, entity_public_id text, payload jsonb, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
BEGIN
  IF p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid event limit' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  SELECT recent.id, recent.event_type, recent.entity_type, recent.entity_public_id, recent.payload, recent.occurred_at
  FROM (
    SELECT events.* FROM marketplace.events events ORDER BY events.id DESC LIMIT p_limit
  ) recent
  ORDER BY recent.id;
END
$function$;

REVOKE ALL ON FUNCTION api.admin_recent_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.admin_recent_events(integer) TO marketplace_admin;
