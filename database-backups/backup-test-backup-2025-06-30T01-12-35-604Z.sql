--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analysis_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.analysis_templates (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    custom_directions text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analysis_templates OWNER TO neondb_owner;

--
-- Name: analysis_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.analysis_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analysis_templates_id_seq OWNER TO neondb_owner;

--
-- Name: analysis_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.analysis_templates_id_seq OWNED BY public.analysis_templates.id;


--
-- Name: cim_documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.cim_documents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    transcript text NOT NULL,
    directions text NOT NULL,
    regeneration_count integer DEFAULT 0 NOT NULL,
    analysis jsonb NOT NULL,
    is_uploaded_file boolean DEFAULT false NOT NULL,
    uploaded_file_name text,
    uploaded_file_path text,
    uploaded_file_size integer,
    uploaded_file_mime_type text,
    edited_content jsonb,
    logo_url text,
    website_url text,
    website_screenshot_url text,
    selected_images text[],
    logo_url_backup text,
    selected_images_backup text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    share_enabled boolean DEFAULT false NOT NULL,
    share_slug text,
    custom_slug text,
    share_password text,
    share_expires_at timestamp without time zone,
    share_view_count integer DEFAULT 0 NOT NULL,
    share_last_viewed timestamp without time zone,
    nda_protected boolean DEFAULT false NOT NULL,
    nda_template_id integer,
    nda_approval_required boolean DEFAULT false NOT NULL,
    financials_enabled boolean DEFAULT false NOT NULL,
    asking_price text,
    asking_price_included boolean DEFAULT false NOT NULL,
    revenue text,
    revenue_included boolean DEFAULT false NOT NULL,
    ebitda text,
    ebitda_included boolean DEFAULT false NOT NULL,
    current_editor_id integer,
    current_editor_name text,
    edit_started_at timestamp without time zone,
    last_activity_at timestamp without time zone,
    cover_image_url text,
    cover_image_position text,
    cover_image_attribution text,
    cover_image_backup text,
    search_vector text,
    version integer DEFAULT 1 NOT NULL,
    last_modified_by integer
);


ALTER TABLE public.cim_documents OWNER TO neondb_owner;

--
-- Name: cim_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.cim_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cim_documents_id_seq OWNER TO neondb_owner;

--
-- Name: cim_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.cim_documents_id_seq OWNED BY public.cim_documents.id;


--
-- Name: collaborators; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.collaborators (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    user_id integer NOT NULL,
    invited_by integer NOT NULL,
    email text NOT NULL,
    permission text NOT NULL,
    status text NOT NULL,
    invite_token text,
    invited_at timestamp without time zone DEFAULT now() NOT NULL,
    responded_at timestamp without time zone
);


ALTER TABLE public.collaborators OWNER TO neondb_owner;

--
-- Name: collaborators_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.collaborators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.collaborators_id_seq OWNER TO neondb_owner;

--
-- Name: collaborators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.collaborators_id_seq OWNED BY public.collaborators.id;


--
-- Name: custom_sections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.custom_sections (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    type text NOT NULL,
    title text,
    content text,
    image_urls text[],
    image_url text,
    image_urls_backup text[],
    "position" integer NOT NULL,
    insert_after_section text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.custom_sections OWNER TO neondb_owner;

--
-- Name: custom_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.custom_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.custom_sections_id_seq OWNER TO neondb_owner;

--
-- Name: custom_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.custom_sections_id_seq OWNED BY public.custom_sections.id;


--
-- Name: custom_tags; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.custom_tags (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.custom_tags OWNER TO neondb_owner;

--
-- Name: custom_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.custom_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.custom_tags_id_seq OWNER TO neondb_owner;

--
-- Name: custom_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.custom_tags_id_seq OWNED BY public.custom_tags.id;


--
-- Name: document_analytics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.document_analytics (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    user_id integer NOT NULL,
    action text NOT NULL,
    metadata jsonb,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    session_id text
);


ALTER TABLE public.document_analytics OWNER TO neondb_owner;

--
-- Name: document_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.document_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_analytics_id_seq OWNER TO neondb_owner;

--
-- Name: document_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.document_analytics_id_seq OWNED BY public.document_analytics.id;


--
-- Name: document_baselines; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.document_baselines (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    baseline_transcript text,
    baseline_directions text,
    baseline_financials jsonb,
    original_transcript text NOT NULL,
    original_directions text NOT NULL,
    company_name text,
    industry text,
    business_model text,
    primary_market text,
    original_revenue text,
    original_ebitda text,
    original_employee_count integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.document_baselines OWNER TO neondb_owner;

--
-- Name: document_baselines_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.document_baselines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_baselines_id_seq OWNER TO neondb_owner;

--
-- Name: document_baselines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.document_baselines_id_seq OWNED BY public.document_baselines.id;


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.document_versions (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    version integer NOT NULL,
    changes jsonb NOT NULL,
    changed_by integer NOT NULL,
    change_description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.document_versions OWNER TO neondb_owner;

--
-- Name: document_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.document_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_versions_id_seq OWNER TO neondb_owner;

--
-- Name: document_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.document_versions_id_seq OWNED BY public.document_versions.id;


--
-- Name: document_views; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.document_views (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    viewer_type text NOT NULL,
    viewer_identifier text,
    ip_address text,
    user_agent text,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL,
    location text
);


ALTER TABLE public.document_views OWNER TO neondb_owner;

--
-- Name: document_views_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.document_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_views_id_seq OWNER TO neondb_owner;

--
-- Name: document_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.document_views_id_seq OWNED BY public.document_views.id;


--
-- Name: financial_files; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.financial_files (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    filename text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.financial_files OWNER TO neondb_owner;

--
-- Name: financial_files_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.financial_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.financial_files_id_seq OWNER TO neondb_owner;

--
-- Name: financial_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.financial_files_id_seq OWNED BY public.financial_files.id;


--
-- Name: investor_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.investor_contacts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    total_document_views integer DEFAULT 0 NOT NULL,
    total_time_spent_minutes integer DEFAULT 0 NOT NULL,
    first_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_address text,
    location text,
    is_potential_vpn boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investor_contacts OWNER TO neondb_owner;

--
-- Name: investor_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.investor_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.investor_contacts_id_seq OWNER TO neondb_owner;

--
-- Name: investor_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.investor_contacts_id_seq OWNED BY public.investor_contacts.id;


--
-- Name: nda_access_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.nda_access_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    cim_document_id integer NOT NULL,
    nda_signature_id integer NOT NULL,
    signer_email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_accessed_at timestamp without time zone,
    expires_at timestamp without time zone
);


ALTER TABLE public.nda_access_tokens OWNER TO neondb_owner;

--
-- Name: nda_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.nda_access_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nda_access_tokens_id_seq OWNER TO neondb_owner;

--
-- Name: nda_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.nda_access_tokens_id_seq OWNED BY public.nda_access_tokens.id;


--
-- Name: nda_redirect_links; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.nda_redirect_links (
    id integer NOT NULL,
    redirect_id text NOT NULL,
    current_token_id integer NOT NULL,
    cim_document_id integer NOT NULL,
    signer_email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nda_redirect_links OWNER TO neondb_owner;

--
-- Name: nda_redirect_links_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.nda_redirect_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nda_redirect_links_id_seq OWNER TO neondb_owner;

--
-- Name: nda_redirect_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.nda_redirect_links_id_seq OWNED BY public.nda_redirect_links.id;


--
-- Name: nda_signatures; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.nda_signatures (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    share_slug text,
    signer_name text NOT NULL,
    signer_email text NOT NULL,
    signer_ip_address text NOT NULL,
    signer_location text,
    signed_at timestamp without time zone DEFAULT now() NOT NULL,
    signed_nda_content text NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    approved_at timestamp without time zone,
    approved_by integer,
    field_values jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.nda_signatures OWNER TO neondb_owner;

--
-- Name: nda_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.nda_signatures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nda_signatures_id_seq OWNER TO neondb_owner;

--
-- Name: nda_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.nda_signatures_id_seq OWNED BY public.nda_signatures.id;


--
-- Name: nda_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.nda_templates (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    file_content text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    signature_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    page_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_pages integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nda_templates OWNER TO neondb_owner;

--
-- Name: nda_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.nda_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nda_templates_id_seq OWNER TO neondb_owner;

--
-- Name: nda_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.nda_templates_id_seq OWNED BY public.nda_templates.id;


--
-- Name: search_index; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.search_index (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    content text NOT NULL,
    content_type text NOT NULL,
    search_vector text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.search_index OWNER TO neondb_owner;

--
-- Name: search_index_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.search_index_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.search_index_id_seq OWNER TO neondb_owner;

--
-- Name: search_index_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.search_index_id_seq OWNED BY public.search_index.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- Name: share_links; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.share_links (
    id integer NOT NULL,
    user_id integer NOT NULL,
    cim_document_id integer NOT NULL,
    share_slug text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    view_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.share_links OWNER TO neondb_owner;

--
-- Name: share_links_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.share_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.share_links_id_seq OWNER TO neondb_owner;

--
-- Name: share_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.share_links_id_seq OWNED BY public.share_links.id;


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.uploaded_files (
    id integer NOT NULL,
    cim_document_id integer NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.uploaded_files OWNER TO neondb_owner;

--
-- Name: uploaded_files_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.uploaded_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.uploaded_files_id_seq OWNER TO neondb_owner;

--
-- Name: uploaded_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.uploaded_files_id_seq OWNED BY public.uploaded_files.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    subscription_status text DEFAULT 'free'::text NOT NULL,
    subscription_ends_at timestamp without time zone,
    monthly_usage integer DEFAULT 0 NOT NULL,
    monthly_documents_created integer DEFAULT 0 NOT NULL,
    monthly_regenerations_used integer DEFAULT 0 NOT NULL,
    last_usage_reset timestamp without time zone DEFAULT now() NOT NULL,
    stripe_customer_id text,
    subscription_id text,
    google_access_token text,
    google_refresh_token text,
    google_token_expiry timestamp without time zone,
    name text,
    title text,
    phone_number text,
    business_name text,
    business_logo text,
    profile_photo text,
    business_logo_backup text,
    profile_photo_backup text,
    reset_token text,
    reset_token_expiry timestamp without time zone,
    pdf_background_template text DEFAULT 'classic'::text
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: analysis_templates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.analysis_templates ALTER COLUMN id SET DEFAULT nextval('public.analysis_templates_id_seq'::regclass);


--
-- Name: cim_documents id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cim_documents ALTER COLUMN id SET DEFAULT nextval('public.cim_documents_id_seq'::regclass);


--
-- Name: collaborators id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.collaborators ALTER COLUMN id SET DEFAULT nextval('public.collaborators_id_seq'::regclass);


--
-- Name: custom_sections id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_sections ALTER COLUMN id SET DEFAULT nextval('public.custom_sections_id_seq'::regclass);


--
-- Name: custom_tags id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_tags ALTER COLUMN id SET DEFAULT nextval('public.custom_tags_id_seq'::regclass);


--
-- Name: document_analytics id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_analytics ALTER COLUMN id SET DEFAULT nextval('public.document_analytics_id_seq'::regclass);


--
-- Name: document_baselines id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_baselines ALTER COLUMN id SET DEFAULT nextval('public.document_baselines_id_seq'::regclass);


--
-- Name: document_versions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_versions ALTER COLUMN id SET DEFAULT nextval('public.document_versions_id_seq'::regclass);


--
-- Name: document_views id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_views ALTER COLUMN id SET DEFAULT nextval('public.document_views_id_seq'::regclass);


--
-- Name: financial_files id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.financial_files ALTER COLUMN id SET DEFAULT nextval('public.financial_files_id_seq'::regclass);


--
-- Name: investor_contacts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.investor_contacts ALTER COLUMN id SET DEFAULT nextval('public.investor_contacts_id_seq'::regclass);


--
-- Name: nda_access_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.nda_access_tokens_id_seq'::regclass);


--
-- Name: nda_redirect_links id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_redirect_links ALTER COLUMN id SET DEFAULT nextval('public.nda_redirect_links_id_seq'::regclass);


--
-- Name: nda_signatures id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_signatures ALTER COLUMN id SET DEFAULT nextval('public.nda_signatures_id_seq'::regclass);


--
-- Name: nda_templates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_templates ALTER COLUMN id SET DEFAULT nextval('public.nda_templates_id_seq'::regclass);


--
-- Name: search_index id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.search_index ALTER COLUMN id SET DEFAULT nextval('public.search_index_id_seq'::regclass);


--
-- Name: share_links id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.share_links ALTER COLUMN id SET DEFAULT nextval('public.share_links_id_seq'::regclass);


--
-- Name: uploaded_files id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.uploaded_files ALTER COLUMN id SET DEFAULT nextval('public.uploaded_files_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: analysis_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.analysis_templates (id, user_id, name, custom_directions, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cim_documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.cim_documents (id, user_id, title, transcript, directions, regeneration_count, analysis, is_uploaded_file, uploaded_file_name, uploaded_file_path, uploaded_file_size, uploaded_file_mime_type, edited_content, logo_url, website_url, website_screenshot_url, selected_images, logo_url_backup, selected_images_backup, created_at, share_enabled, share_slug, custom_slug, share_password, share_expires_at, share_view_count, share_last_viewed, nda_protected, nda_template_id, nda_approval_required, financials_enabled, asking_price, asking_price_included, revenue, revenue_included, ebitda, ebitda_included, current_editor_id, current_editor_name, edit_started_at, last_activity_at, cover_image_url, cover_image_position, cover_image_attribution, cover_image_backup, search_vector, version, last_modified_by) FROM stdin;
\.


--
-- Data for Name: collaborators; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.collaborators (id, cim_document_id, user_id, invited_by, email, permission, status, invite_token, invited_at, responded_at) FROM stdin;
\.


--
-- Data for Name: custom_sections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.custom_sections (id, cim_document_id, type, title, content, image_urls, image_url, image_urls_backup, "position", insert_after_section, created_at) FROM stdin;
\.


--
-- Data for Name: custom_tags; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.custom_tags (id, user_id, name, color, created_at) FROM stdin;
\.


--
-- Data for Name: document_analytics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.document_analytics (id, cim_document_id, user_id, action, metadata, "timestamp", session_id) FROM stdin;
\.


--
-- Data for Name: document_baselines; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.document_baselines (id, cim_document_id, baseline_transcript, baseline_directions, baseline_financials, original_transcript, original_directions, company_name, industry, business_model, primary_market, original_revenue, original_ebitda, original_employee_count, created_at) FROM stdin;
\.


--
-- Data for Name: document_versions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.document_versions (id, cim_document_id, version, changes, changed_by, change_description, created_at) FROM stdin;
\.


--
-- Data for Name: document_views; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.document_views (id, cim_document_id, viewer_type, viewer_identifier, ip_address, user_agent, viewed_at, location) FROM stdin;
\.


--
-- Data for Name: financial_files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.financial_files (id, cim_document_id, filename, file_path, file_size, uploaded_at) FROM stdin;
\.


--
-- Data for Name: investor_contacts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.investor_contacts (id, user_id, email, name, notes, tags, status, last_contact_date, next_follow_up_date, total_document_views, total_time_spent_minutes, first_seen_at, last_seen_at, ip_address, location, is_potential_vpn, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nda_access_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.nda_access_tokens (id, token, cim_document_id, nda_signature_id, signer_email, is_active, created_at, last_accessed_at, expires_at) FROM stdin;
\.


--
-- Data for Name: nda_redirect_links; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.nda_redirect_links (id, redirect_id, current_token_id, cim_document_id, signer_email, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nda_signatures; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.nda_signatures (id, cim_document_id, share_slug, signer_name, signer_email, signer_ip_address, signer_location, signed_at, signed_nda_content, approved, approved_at, approved_by, field_values) FROM stdin;
\.


--
-- Data for Name: nda_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.nda_templates (id, user_id, name, file_content, is_default, signature_fields, page_images, total_pages, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: search_index; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.search_index (id, cim_document_id, content, content_type, search_vector, updated_at) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
YSharlKFjJseaSULFR3o-uAglUhmrSsq	{"cookie":{"originalMaxAge":86400000,"expires":"2025-07-01T01:08:48.798Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2025-07-01 01:12:26
\.


--
-- Data for Name: share_links; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.share_links (id, user_id, cim_document_id, share_slug, created_at, expires_at, view_count) FROM stdin;
\.


--
-- Data for Name: uploaded_files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.uploaded_files (id, cim_document_id, file_name, file_path, file_size, mime_type, uploaded_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, email, password, is_admin, subscription_status, subscription_ends_at, monthly_usage, monthly_documents_created, monthly_regenerations_used, last_usage_reset, stripe_customer_id, subscription_id, google_access_token, google_refresh_token, google_token_expiry, name, title, phone_number, business_name, business_logo, profile_photo, business_logo_backup, profile_photo_backup, reset_token, reset_token_expiry, pdf_background_template) FROM stdin;
1	robert@dealve.cc	b8463e1c1daa94e25001fa7e11b2818f91d27cd6fcf432c521157e493d59bdda8ed9b649f4dd7b6d3770a922c685cc2f369fce3d90e0971d3a49942130684a01.ebbed4fc60affc7d3815910fe504d262	t	premium	2035-06-30 01:08:25.922	0	0	0	2025-06-30 01:08:25.87746	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	classic
\.


--
-- Name: analysis_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.analysis_templates_id_seq', 1, false);


--
-- Name: cim_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.cim_documents_id_seq', 1, false);


--
-- Name: collaborators_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.collaborators_id_seq', 1, false);


--
-- Name: custom_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.custom_sections_id_seq', 1, false);


--
-- Name: custom_tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.custom_tags_id_seq', 1, false);


--
-- Name: document_analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.document_analytics_id_seq', 1, false);


--
-- Name: document_baselines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.document_baselines_id_seq', 1, false);


--
-- Name: document_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.document_versions_id_seq', 1, false);


--
-- Name: document_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.document_views_id_seq', 1, false);


--
-- Name: financial_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.financial_files_id_seq', 1, false);


--
-- Name: investor_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.investor_contacts_id_seq', 1, false);


--
-- Name: nda_access_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.nda_access_tokens_id_seq', 1, false);


--
-- Name: nda_redirect_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.nda_redirect_links_id_seq', 1, false);


--
-- Name: nda_signatures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.nda_signatures_id_seq', 1, false);


--
-- Name: nda_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.nda_templates_id_seq', 1, false);


--
-- Name: search_index_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.search_index_id_seq', 1, false);


--
-- Name: share_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.share_links_id_seq', 1, false);


--
-- Name: uploaded_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.uploaded_files_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: analysis_templates analysis_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.analysis_templates
    ADD CONSTRAINT analysis_templates_pkey PRIMARY KEY (id);


--
-- Name: cim_documents cim_documents_custom_slug_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cim_documents
    ADD CONSTRAINT cim_documents_custom_slug_unique UNIQUE (custom_slug);


--
-- Name: cim_documents cim_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cim_documents
    ADD CONSTRAINT cim_documents_pkey PRIMARY KEY (id);


--
-- Name: cim_documents cim_documents_share_slug_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cim_documents
    ADD CONSTRAINT cim_documents_share_slug_unique UNIQUE (share_slug);


--
-- Name: collaborators collaborators_invite_token_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_invite_token_unique UNIQUE (invite_token);


--
-- Name: collaborators collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_pkey PRIMARY KEY (id);


--
-- Name: custom_sections custom_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_sections
    ADD CONSTRAINT custom_sections_pkey PRIMARY KEY (id);


--
-- Name: custom_tags custom_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_tags
    ADD CONSTRAINT custom_tags_pkey PRIMARY KEY (id);


--
-- Name: document_analytics document_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_analytics
    ADD CONSTRAINT document_analytics_pkey PRIMARY KEY (id);


--
-- Name: document_baselines document_baselines_cim_document_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_baselines
    ADD CONSTRAINT document_baselines_cim_document_id_unique UNIQUE (cim_document_id);


--
-- Name: document_baselines document_baselines_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_baselines
    ADD CONSTRAINT document_baselines_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: document_views document_views_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_pkey PRIMARY KEY (id);


--
-- Name: financial_files financial_files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.financial_files
    ADD CONSTRAINT financial_files_pkey PRIMARY KEY (id);


--
-- Name: investor_contacts investor_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.investor_contacts
    ADD CONSTRAINT investor_contacts_pkey PRIMARY KEY (id);


--
-- Name: nda_access_tokens nda_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_access_tokens
    ADD CONSTRAINT nda_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: nda_access_tokens nda_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_access_tokens
    ADD CONSTRAINT nda_access_tokens_token_unique UNIQUE (token);


--
-- Name: nda_redirect_links nda_redirect_links_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_redirect_links
    ADD CONSTRAINT nda_redirect_links_pkey PRIMARY KEY (id);


--
-- Name: nda_redirect_links nda_redirect_links_redirect_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_redirect_links
    ADD CONSTRAINT nda_redirect_links_redirect_id_unique UNIQUE (redirect_id);


--
-- Name: nda_signatures nda_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_signatures
    ADD CONSTRAINT nda_signatures_pkey PRIMARY KEY (id);


--
-- Name: nda_templates nda_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.nda_templates
    ADD CONSTRAINT nda_templates_pkey PRIMARY KEY (id);


--
-- Name: search_index search_index_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.search_index
    ADD CONSTRAINT search_index_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: share_links share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_share_slug_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_share_slug_unique UNIQUE (share_slug);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_stripe_customer_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_stripe_customer_id_unique UNIQUE (stripe_customer_id);


--
-- Name: users users_subscription_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_subscription_id_unique UNIQUE (subscription_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

