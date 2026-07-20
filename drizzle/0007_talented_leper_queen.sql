DROP INDEX "notification_settings_type_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_type_phone_uidx" ON "notification_settings" USING btree ("notification_type","phone_number");--> statement-breakpoint
CREATE INDEX "notification_settings_type_idx" ON "notification_settings" USING btree ("notification_type");