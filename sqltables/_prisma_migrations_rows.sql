INSERT INTO "public"."_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('0db1187d-5dfc-4a5c-b59d-8e39aac7bc06', '60d0e408eb365b343d95dcc218f31be78d10c9b0d4f9f2a7d44855b401e30277', '2026-06-12 07:29:40.839661+00', '20260611_interview_turn_timestamp_ms', null, null, '2026-06-12 07:29:40.042141+00', 1), ('10873ca7-87dd-47ea-a7ac-646bae28014a', '2fa248cbe759d3983271b181e14e4586797e3d1fd92b4df5079aeceeed20d702', '2026-04-23 14:59:41.984346+00', '20260423_scorecard_details', null, null, '2026-04-23 14:59:40.306248+00', 1), ('18b3edba-a096-4932-b4a1-379085f8ac43', 'c182df0cc518b1a9a348ef511c561148b620e826b231da007e22995459b5f32f', '2026-05-21 13:26:42.146792+00', '20260519_question_grading', null, null, '2026-05-21 13:26:41.327417+00', 1), ('343eb514-f27c-4dad-b95f-c3e673235bf5', '94683c4a6762511e4ea02cb0d8c79dcc933c8a6ef4340e5232cde21707fda792', null, '20260420_init', 'A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve

Migration name: 20260420_init

Database error code: 42601

Database error:
ERROR: syntax error at or near "﻿"

Position:
[1m  0[0m
[1m  1[1;31m ﻿-- CreateEnum[0m

DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42601), message: "syntax error at or near \"\u{feff}\"", detail: None, hint: None, position: Some(Original(1)), where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("scan.l"), line: Some(1244), routine: Some("scanner_yyerror") }

   0: sql_schema_connector::apply_migration::apply_script
           with migration_name="20260420_init"
             at schema-engine\connectors\sql-schema-connector\src\apply_migration.rs:113
   1: schema_commands::commands::apply_migrations::Applying migration
           with migration_name="20260420_init"
             at schema-engine\commands\src\commands\apply_migrations.rs:95
   2: schema_core::state::ApplyMigrations
             at schema-engine\core\src\state.rs:260', '2026-04-20 15:19:44.62467+00', '2026-04-20 15:18:18.669941+00', 0), ('64d809c0-fb45-4e3f-9dcf-1a1094ba347b', '9c42b9427a7867447cd13bbaa0329d286c355b67668931b0d2fbc338a1317ac7', '2026-05-14 12:01:14.359547+00', '20260514_company_video_compliance', null, null, '2026-05-14 12:01:13.17226+00', 1), ('6d57c2b6-ac05-48e8-881a-137d7ec816a9', 'c6f9561a112af1229d2866cbb52fe4d909b24dc9979dd1603743ee0dc1e53179', '2026-05-14 11:27:16.07841+00', '20260428_scoring_batch_jobs', null, null, '2026-05-14 11:27:14.952142+00', 1), ('86062e22-59bd-4a87-be74-fcbd91df7a73', '237bc4531da07fe80b805b631c6985fe55782666008761eaa8aa440165094667', '2026-05-15 16:52:15.784642+00', '20260515_interview_turn_order_index', null, null, '2026-05-15 16:52:14.774124+00', 1), ('bc606de3-8b50-4b5b-b6aa-db3cbebb29d7', 'dfb2ffd5b149dc7ef538f3bada93778e289c3ae9618f6c4a610935e7a7296205', null, '20260615_requirement_invite_expiry', 'A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve

Migration name: 20260615_requirement_invite_expiry

Database error code: 42P01

Database error:
ERROR: relation "RequirementInvite" does not exist

DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \"RequirementInvite\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(636), routine: Some("RangeVarGetRelidExtended") }

   0: sql_schema_connector::apply_migration::apply_script
           with migration_name="20260615_requirement_invite_expiry"
             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113
   1: schema_commands::commands::apply_migrations::Applying migration
           with migration_name="20260615_requirement_invite_expiry"
             at schema-engine/commands/src/commands/apply_migrations.rs:95
   2: schema_core::state::ApplyMigrations
             at schema-engine/core/src/state.rs:260', '2026-06-15 06:56:47.278459+00', '2026-06-15 06:30:36.178832+00', 0), ('bfa1eed6-10a1-44bb-ae56-7ff623112591', '8eb905ab67376ac922f1f563757f1cd2952ee7c4b1cd0d89be8f22b7d0990874', '2026-06-15 06:56:53.887287+00', '20260615_requirement_invites', null, null, '2026-06-15 06:56:53.00231+00', 1), ('c1555678-77a0-45a6-96b6-60ac990d36c4', '96e0ea0d3922902d5f8d2d9cf891d5bd307ab04846e6b314d68a2cc58afcfdbb', '2026-05-14 11:27:17.709996+00', '20260514_scorecard_share_links', null, null, '2026-05-14 11:27:16.487541+00', 1), ('d77c4c5a-a948-4c23-9d38-81cf9935bb92', '784dc8af1e666c5315b9858ca3b7cdee6968dd94b90ff28d005a07203fed4798', '2026-05-29 05:25:48.104975+00', '20260522_company_interviewer_profile', null, null, '2026-05-29 05:25:47.180379+00', 1), ('e14aa7d2-7c99-4eb4-929d-d4876b4c8e5a', 'b1853c5dae72b568cb2513cc49c2e9cd9190228f46f6ebf0951a60e06860ea24', '2026-04-20 15:20:05.888146+00', '20260420_init', null, null, '2026-04-20 15:20:04.046784+00', 1), ('e7d78ba7-34ad-4157-9786-cb0e155120f6', '6a2eabf13ac47d38cf87df4c440a879fce117b538aeaa93a1104f8d0ee52bcd1', null, '20260420_init', 'A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve

Migration name: 20260420_init

Database error code: none

Database error:
error encoding message to server: string contains embedded null

   0: sql_schema_connector::apply_migration::apply_script
           with migration_name="20260420_init"
             at schema-engine\connectors\sql-schema-connector\src\apply_migration.rs:113
   1: schema_commands::commands::apply_migrations::Applying migration
           with migration_name="20260420_init"
             at schema-engine\commands\src\commands\apply_migrations.rs:95
   2: schema_core::state::ApplyMigrations
             at schema-engine\core\src\state.rs:260', '2026-04-20 15:17:55.841679+00', '2026-04-20 15:15:49.490024+00', 0), ('fdeb0abc-d54b-4616-a240-4c94fe06abb3', '8461da08775090922e2a17b21e96af429897d9e962c7f2f1e0eb3c16f7f89739', '2026-05-15 02:58:21.509777+00', '20260515_revert_disqualification', null, null, '2026-05-15 02:58:20.135635+00', 1);