--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: app_installs; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE app_installs (
    id integer NOT NULL,
    app text NOT NULL,
    shop text NOT NULL,
    token text NOT NULL,
    scope_hash TEXT DEFAULT NULL,
    lastaccessed timestamp without time zone,
    uninstalled timestamp without time zone,
    is_subscribed boolean not null default false,
    subscription_ends date null,
    lastmodified timestamp with time zone DEFAULT now()
);

CREATE INDEX ON app_installs (app, shop);



-- ALTER TABLE app_installs OWNER TO postgres;

--
-- Name: app_installs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE app_installs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER TABLE app_installs_id_seq OWNER TO postgres;

--
-- Name: app_installs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE app_installs_id_seq OWNED BY app_installs.id;


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY app_installs ALTER COLUMN id SET DEFAULT nextval('app_installs_id_seq'::regclass);

 
CREATE OR REPLACE FUNCTION update_lastmodified_column()
        RETURNS TRIGGER AS '
  BEGIN
    NEW.lastmodified = NOW();
    RETURN NEW;
  END;
' LANGUAGE 'plpgsql';

--
-- Name: update_lastmodified_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_lastmodified_modtime BEFORE UPDATE ON app_installs FOR EACH ROW EXECUTE PROCEDURE update_lastmodified_column();


--
-- PostgreSQL database dump complete
--

