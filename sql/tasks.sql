CREATE TABLE public.tasks (
	id serial4 NOT NULL,
	status varchar NOT NULL,
	valid_since timestamptz NOT NULL,
	valid_until timestamptz NOT NULL,
	url varchar NOT NULL,
	attempts int4 NOT NULL,
	attempts_limit int4 NOT NULL,
	process_id varchar NULL,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT tasks_pk PRIMARY KEY (id),
	CONSTRAINT tasks_un UNIQUE (process_id)
);