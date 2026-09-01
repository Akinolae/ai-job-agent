import sys
import json
import argparse
import concurrent.futures

SITE_TIMEOUT_SECONDS = 90  # Max seconds to wait per site per search


import re

# Comprehensive dictionary mapping target country codes to aliases, major cities, and regions across 4 continents
COUNTRY_LOCATION_MAP = {
    # Americas
    "usa": ("usa", "united states", "us", "u.s.", "america", "new york", "san francisco", "austin", "seattle", "california", "texas", "remote us", "remote usa"),
    "canada": ("canada", "toronto", "vancouver", "montreal", "ottawa", "ontario", "quebec", "british columbia", "remote canada"),
    "mexico": ("mexico", "mexico city", "guadalajara", "monterrey", "remote mexico"),
    "brazil": ("brazil", "brasil", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "remote brazil"),
    "argentina": ("argentina", "buenos aires", "cordoba", "rosario"),
    "colombia": ("colombia", "bogota", "medellin", "cali"),
    "chile": ("chile", "santiago", "valparaiso"),
    "costa rica": ("costa rica", "san jose"),
    "uruguay": ("uruguay", "montevideo"),
    # Europe
    "uk": ("uk", "united kingdom", "great britain", "england", "scotland", "wales", "london", "manchester", "birmingham", "edinburgh", "bristol", "leeds", "remote uk"),
    "germany": ("germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg", "cologne", "stuttgart", "dusseldorf", "remote germany", "remote eu"),
    "netherlands": ("netherlands", "holland", "amsterdam", "rotterdam", "utrecht", "the hague", "eindhoven", "remote netherlands"),
    "france": ("france", "paris", "lyon", "marseille", "toulouse", "bordeaux", "nantes"),
    "spain": ("spain", "espana", "madrid", "barcelona", "valencia", "seville", "malaga"),
    "italy": ("italy", "italia", "rome", "milan", "turin", "florence", "bologna"),
    "ireland": ("ireland", "dublin", "cork", "galway", "limerick"),
    "switzerland": ("switzerland", "zurich", "geneva", "basel", "lausanne", "bern"),
    "sweden": ("sweden", "stockholm", "gothenburg", "malmo"),
    "poland": ("poland", "warsaw", "krakow", "wroclaw", "gdansk", "poznan"),
    "belgium": ("belgium", "brussels", "antwerp", "ghent", "bruges"),
    "austria": ("austria", "vienna", "salzburg", "graz"),
    "portugal": ("portugal", "lisbon", "porto", "braga"),
    "norway": ("norway", "oslo", "bergen", "trondheim"),
    "denmark": ("denmark", "copenhagen", "aarhus", "odense"),
    "finland": ("finland", "helsinki", "espoo", "tampere"),
    "czech republic": ("czech republic", "czechia", "prague", "brno"),
    "romania": ("romania", "bucharest", "cluj", "timisoara", "iasi"),
    "estonia": ("estonia", "tallinn", "tartu"),
    "greece": ("greece", "athens", "thessaloniki"),
    "hungary": ("hungary", "budapest"),
    # Africa
    "nigeria": ("nigeria", "lagos", "abuja", "port harcourt", "ibadan", "enugu", "kano", "remote nigeria", "remote africa"),
    "south africa": ("south africa", "cape town", "johannesburg", "durban", "pretoria", "remote south africa"),
    "kenya": ("kenya", "nairobi", "mombasa", "kisumu", "remote kenya"),
    "ghana": ("ghana", "accra", "kumasi", "tema", "remote ghana"),
    "egypt": ("egypt", "cairo", "alexandria", "giza"),
    "morocco": ("morocco", "casablanca", "rabat", "marrakech", "tangier"),
    "rwanda": ("rwanda", "kigali"),
    "uganda": ("uganda", "kampala"),
    "senegal": ("senegal", "dakar"),
    "mauritius": ("mauritius", "port louis"),
    # Middle East & Asia-Pacific
    "singapore": ("singapore", "remote singapore", "remote apac"),
    "uae": ("uae", "united arab emirates", "dubai", "abu dhabi", "sharjah", "remote uae", "remote emea"),
    "saudi arabia": ("saudi arabia", "riyadh", "jeddah", "dammam"),
    "israel": ("israel", "tel aviv", "jerusalem", "haifa"),
    "qatar": ("qatar", "doha"),
    "india": ("india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai", "gurgaon", "noida", "remote india"),
    "australia": ("australia", "sydney", "melbourne", "brisbane", "perth", "adelaide", "remote australia"),
    "new zealand": ("new zealand", "auckland", "wellington", "christchurch"),
    "japan": ("japan", "tokyo", "osaka", "kyoto", "fukuoka", "yokohama"),
    "south korea": ("south korea", "korea", "seoul", "busan", "incheon"),
    "hong kong": ("hong kong", "hk"),
    "taiwan": ("taiwan", "taipei", "hsinchu"),
    "malaysia": ("malaysia", "kuala lumpur", "penang", "cyberjaya"),
    "philippines": ("philippines", "manila", "cebu", "quezon city"),
    "vietnam": ("vietnam", "ho chi minh", "hanoi", "da nang"),
    "thailand": ("thailand", "bangkok", "chiang mai"),
    "indonesia": ("indonesia", "jakarta", "bali", "bandung"),
}

# Inverted keyword mapping table: token -> canonical country code
_FLATTENED_COUNTRY_MAP = {}
for country, keywords in COUNTRY_LOCATION_MAP.items():
    for kw in keywords:
        _FLATTENED_COUNTRY_MAP[kw.lower()] = country

# Pre-compiled word-boundary regex patterns for short tokens (<=3 chars) to avoid false positives (e.g. 'us', 'uk')
_SHORT_KEYWORD_PATTERNS = {
    kw: re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
    for kw in _FLATTENED_COUNTRY_MAP if len(kw) <= 3
}

def map_country_for_indeed(location_str: str, default_country: str = "worldwide") -> str:
    """
    Intelligently and efficiently maps arbitrary location strings, city names,
    country aliases, and regions to standard Indeed country codes across Europe, Americas, Asia, and Africa.
    """
    if not location_str:
        return default_country

    loc = location_str.strip().lower()

    # 1. Exact match fast path
    if loc in _FLATTENED_COUNTRY_MAP:
        return _FLATTENED_COUNTRY_MAP[loc]

    # 2. Priority match by longest keyword first (e.g. 'south africa' before 'africa')
    for kw, country in sorted(_FLATTENED_COUNTRY_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if len(kw) <= 3:
            if _SHORT_KEYWORD_PATTERNS[kw].search(loc):
                return country
        elif kw in loc:
            return country

    # 3. Check regional groupings for defaults
    if any(k in loc for k in ("europe", "eu", "emea", "germany", "netherlands", "uk")):
        return "uk"
    if any(k in loc for k in ("africa", "nigeria", "ghana", "kenya", "south africa")):
        return "south africa"
    if any(k in loc for k in ("asia", "apac", "singapore", "india", "japan")):
        return "singapore"
    if any(k in loc for k in ("latam", "americas", "brazil", "canada")):
        return "canada"

    return default_country


def scrape_single_site(site, search_term, location, limit, hours_old, country):
    """Scrape a single job board site and return a list of job dicts."""
    # Normalize site identifier
    site_key = site.strip().lower()
    if site_key == "ziprecruiter":
        site_key = "zip_recruiter"

    try:
        from jobspy.model import Country
        if not getattr(Country, '_patched_safe', False):
            orig_from_str = Country.from_string
            @classmethod
            def safe_from_string(cls, country_str: str):
                try:
                    return orig_from_str(country_str)
                except Exception:
                    return Country.WORLDWIDE
            Country.from_string = safe_from_string
            Country._patched_safe = True

        is_remote_query = any(k in (location or "").lower() for k in ("remote", "worldwide", "anywhere", "global", "telecommute"))
        from jobspy import scrape_jobs
        
        # Scrape with robust parameter handling across all supported boards
        jobs_df = scrape_jobs(
            site_name=[site_key],
            search_term=search_term,
            location="" if is_remote_query else location,
            is_remote=is_remote_query,
            results_wanted=limit,
            hours_old=hours_old or 336,  # 336 hours = 2 weeks
            country_indeed=country or "worldwide",
            verbose=0,
        )
        results = []
        if jobs_df is not None and not jobs_df.empty:
            jobs_df = jobs_df.fillna("")
            for r in jobs_df.to_dict(orient="records"):
                job_url = str(r.get("job_url", "")).strip()
                loc_val = str(r.get("location", "")).strip()
                workplace_val = str(r.get("job_type", "")).strip()
                if is_remote_query and (not workplace_val or workplace_val.lower() == "full-time"):
                    workplace_val = "Remote"
                if is_remote_query and not loc_val:
                    loc_val = f"Remote ({location or 'Worldwide'})"
                results.append({
                    "id": str(r.get("id", "")),
                    "title": str(r.get("title", "")).strip(),
                    "company": str(r.get("company", "")).strip(),
                    "location": loc_val or location or "Worldwide Remote",
                    "workplace_type": workplace_val or "Full-time",
                    "job_url": job_url,
                    "description": str(r.get("description", "")),
                    "site": site_key,
                    "date_posted": str(r.get("date_posted", "")),
                })
        print(f"  [{site_key}] {len(results)} results for '{search_term}' in '{location}' (2-week window)", file=sys.stderr)
        return results
    except Exception as e:
        print(f"  [{site_key}] Board query note/error for '{search_term}': {e}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description="Multi-board job scraper using python-jobspy")
    parser.add_argument("--search", type=str, required=True, help="Primary search term")
    parser.add_argument("--searches", type=str, default="", help="JSON array of extra search terms")
    parser.add_argument("--location", type=str, default="", help="Location search filter")
    parser.add_argument("--locations", type=str, default="", help="JSON array of extra locations")
    parser.add_argument("--sites", type=str, default="indeed,linkedin,zip_recruiter,glassdoor,google", help="Comma-separated list of boards to search")
    parser.add_argument("--limit", type=int, default=10, help="Results per site per search")
    parser.add_argument("--hours", type=int, default=336, help="Max hours old (336 hours = 2 weeks)")
    parser.add_argument("--country", type=str, default="worldwide", help="Default country for Indeed")
    args = parser.parse_args()

    # Build full list of search terms and locations
    search_terms = [args.search]
    if args.searches:
        try:
            extra = json.loads(args.searches)
            search_terms.extend(extra)
        except Exception:
            pass

    # Ensure unique non-empty search terms
    search_terms = list(dict.fromkeys([t.strip() for t in search_terms if t.strip()]))

    locations = [args.location] if args.location else []
    if args.locations:
        try:
            extra = json.loads(args.locations)
            locations.extend(extra)
        except Exception:
            pass
    if not locations:
        locations = [""]

    locations = list(dict.fromkeys([l.strip() for l in locations]))

    # Target all major live boards across the ecosystem
    sites = [s.strip() for s in args.sites.split(",") if s.strip()]
    if not sites:
        sites = ["indeed", "linkedin", "zip_recruiter", "glassdoor", "google"]

    all_results = []
    seen_urls = set()

    print(f"Scraping {len(sites)} boards ({', '.join(sites)}) across {len(search_terms)} target roles and {len(locations)} locations (Max 2 weeks old / 336h)...", file=sys.stderr)

    try:
        from jobspy import scrape_jobs  # noqa – just verify installed
    except ImportError:
        print(json.dumps({"error": "python-jobspy is not installed. Run: pip install python-jobspy pandas"}))
        sys.exit(1)

    tasks = []
    for term in search_terms:
        for loc in locations:
            for site in sites:
                country = map_country_for_indeed(loc, args.country)
                tasks.append((site, term, loc, country))

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(scrape_single_site, site, term, loc, args.limit, args.hours, country): (site, term, loc)
            for site, term, loc, country in tasks
        }
        for future in concurrent.futures.as_completed(futures, timeout=SITE_TIMEOUT_SECONDS * len(tasks) or 120):
            site, term, loc = futures[future]
            try:
                results = future.result(timeout=SITE_TIMEOUT_SECONDS)
                for r in results:
                    url = r.get("job_url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_results.append(r)
            except concurrent.futures.TimeoutError:
                print(f"  [{site}] TIMEOUT: '{term}' in '{loc}' exceeded {SITE_TIMEOUT_SECONDS}s — skipping.", file=sys.stderr)
            except Exception as e:
                print(f"  [{site}] Unexpected error for '{term}' in '{loc}': {e}", file=sys.stderr)

    print(f"Total unique jobs found: {len(all_results)}", file=sys.stderr)
    print(json.dumps(all_results, indent=2))


if __name__ == "__main__":
    main()
