-- Raise the per-photo upload ceiling from 25MB to 50MB. Phone cameras (and
-- HEIC bursts in particular) regularly exceed 25MB, and the old bucket limit
-- rejected those files inside Storage after the server action had already
-- accepted them. Keep this in step with the check in `uploadPhoto` and with
-- `serverActions.bodySizeLimit` in next.config.ts.

update storage.buckets set file_size_limit = 52428800 where id = 'photos';
