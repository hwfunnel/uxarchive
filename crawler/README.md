# UX Archive Screenshot Crawler

Python + Playwright based local crawler for capturing public mobile web pages before adding them to UX Archive.

This phase only captures screenshots locally and writes metadata JSON. It does not upload to Supabase Storage and does not insert DB rows.

## Current UX Archive Image Structure

Code inspection shows this structure:

- Storage bucket: `screens`
- Storage path rule: `{company_code}/{type_code}/{subtype_code}/{company_code}_{type_code}_{subtype_code}_{screen_type_code}_{version}_{order_no:003}.{ext}`
- Set table inferred from Edge Function: `screen_sets`
- Screen table inferred from Edge Function: `screens`
- Master tables inferred from Edge Function: `companies`, `types`, `subtypes`, `screen_types`

`screen_sets` groups screens by `company_code`, `type_code`, `subtype_code`, `version`, `uploaded_at`, `is_latest`, and `change_summary`.

`screens` stores each image with `set_id`, `screen_type_code`, `order_no`, and `imgsrc`. `imgsrc` is the Storage path inside the `screens` bucket. The site reads `imgsrc` and creates a signed URL through the Edge Function.

## Data The Crawler Produces

For each target URL, the crawler writes:

- `screenshots/{screen_id}.png`
- `metadata/{screen_id}.json`
- `logs/crawler.log`

Metadata includes:

- `screen_id`
- `company_code`, `company_name`
- `type_code`, `subtype_code`, `screen_type_code`, `order_no`, `version`
- `source_url`, `final_url`, `page_title`, `http_status`
- `captured_at`, `viewport`, `device_type`, `full_page`
- `screenshot_path`
- `content_hash` / `screenshot_hash`
- `supabase_candidate.storage_bucket`
- `supabase_candidate.storage_path`
- `supabase_candidate.screen_set`
- `supabase_candidate.screen`

Before Supabase upload, confirm that `company_code`, `type_code`, `subtype_code`, and `screen_type_code` match the actual master data in the production DB.

## Install

From the project root:

```bash
python3 -m pip install -r crawler/requirements.txt
python3 -m playwright install chromium
```

Playwright is already available in the current environment, but the commands above make the setup reproducible on another Mac.

## Run Samsung Pilot

```bash
python3 -m crawler.src.crawl --targets crawler/config/targets.samsung.json
```

Optional viewport-only capture:

```bash
python3 -m crawler.src.crawl --targets crawler/config/targets.samsung.json --above-fold
```

Optional visible browser run:

```bash
python3 -m crawler.src.crawl --targets crawler/config/targets.samsung.json --headful
```

Output example:

```text
crawler_output/
  runs/
    samsung-car-pilot_2026-05-26_153000/
      screenshots/
        SAMSUNG-CAR-MAIN-01.png
      metadata/
        SAMSUNG-CAR-MAIN-01.json
      logs/
        crawler.log
```

## Phase 1 Pilot Scope

- One company: 삼성화재
- One public URL: Samsung Fire direct car insurance landing URL
- Mobile viewport: `390 x 844`
- Mobile user agent
- Full page screenshot by default
- No login
- No identity verification
- No CAPTCHA or security bypass
- No personal information input
- No automatic click/input flow
- No Supabase writes

## Phase 2 Notes

The included `src/supabase_uploader.py` is a disabled stub. Supabase upload/insert should be implemented only after explicit approval.

Required values should be loaded from `.env`, never printed:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `DEFAULT_COMPANY_CODE`
- `DEFAULT_TYPE_CODE`
- `DEFAULT_SUBTYPE_CODE`
