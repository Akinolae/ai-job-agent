import sys
import json
import argparse
import concurrent.futures

SITE_TIMEOUT_SECONDS = 90  # Max seconds to wait per site per search


import re

# Comprehensive dictionary mapping target country codes to aliases, major cities, and regions
COUNTRY_LOCATION_MAP = {
    # Americas
    "usa": ("usa", "united states", "us", "u.s.", "america", "new york", "san francisco", "austin", "seattle", "california", "texas"),
    "canada": ("canada", "toronto", "vancouver", "montreal", "ottawa", "ontario"),
    "mexico": ("mexico", "mexico city", "guadalajara", "monterrey"),
    "brazil": ("brazil", "brasil", "sao paulo", "rio de janeiro"),
    "argentina": ("argentina", "buenos aires"),
    "colombia": ("colombia", "bogota", "medellin"),
    "chile": ("chile", "santiago"),
    # Europe
    "uk": ("uk", "united kingdom", "great britain", "england", "scotland", "wales", "london", "manchester", "birmingham", "edinburgh", "bristol", "leeds"),
    "germany": ("germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg", "cologne", "stuttgart", "dusseldorf"),
    "netherlands": ("netherlands", "holland", "amsterdam", "rotterdam", "utrecht", "the hague", "eindhoven"),
    "france": ("france", "paris", "lyon", "marseille", "toulouse", "bordeaux", "nantes"),
    "spain": ("spain", "espana", "madrid", "barcelona", "valencia", "seville"),
    "italy": ("italy", "italia", "rome", "milan", "turin", "florence"),
    "ireland": ("ireland", "dublin", "cork", "galway"),
    "switzerland": ("switzerland", "zurich", "geneva", "basel", "lausanne", "bern"),
    "sweden": ("sweden", "stockholm", "gothenburg", "malmo"),
    "poland": ("poland", "warsaw", "krakow", "wroclaw", "gdansk"),
    "belgium": ("belgium", "brussels", "antwerp", "ghent"),
    "austria": ("austria", "vienna", "salzburg"),
    "portugal": ("portugal", "lisbon", "porto"),
    "norway": ("norway", "oslo", "bergen"),
    "denmark": ("denmark", "copenhagen", "aarhus"),
    "finland": ("finland", "helsinki", "espoo"),
    "czech republic": ("czech republic", "czechia", "prague", "brno"),
    "romania": ("romania", "bucharest", "cluj"),
    # Africa
    "nigeria": ("nigeria", "lagos", "abuja", "port harcourt", "ibadan"),
    "south africa": ("south africa", "cape town", "johannesburg", "durban", "pretoria"),
    "egypt": ("egypt", "cairo", "alexandria", "giza"),
    "morocco": ("morocco", "casablanca", "rabat", "marrakech"),
    # Middle East & Asia-Pacific
    "uae": ("uae", "united arab emirates", "dubai", "abu dhabi"),
    "saudi arabia": ("saudi arabia", "riyadh", "jeddah"),
    "israel": ("israel", "tel aviv", "jerusalem"),
    "india": ("india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai", "gurgaon", "noida"),
    "singapore": ("singapore",),
    "australia": ("australia", "sydney", "melbourne", "brisbane", "perth", "adelaide"),
    "new zealand": ("new zealand", "auckland", "wellington", "christchurch"),
    "japan": ("japan", "tokyo", "osaka", "kyoto"),
    "south korea": ("south korea", "korea", "seoul", "busan"),
    "hong kong": ("hong kong", "hk"),
    "taiwan": ("taiwan", "taipei"),
    "malaysia": ("malaysia", "kuala lumpur", "penang"),
    "philippines": ("philippines", "manila", "cebu"),
    "vietnam": ("vietnam", "ho chi minh", "hanoi"),
    "thailand": ("thailand", "bangkok"),
    "indonesia": ("indonesia", "jakarta", "bali"),
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
    country aliases, and regions to standard Indeed country codes.
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

    return default_country


def scrape_single_site(site, search_term, location, limit, hours_old, country):
    """Scrape a single job board site and return a list of job dicts."""
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

        is_remote_query = "remote" in (location or "").lower() or "worldwide" in (location or "").lower()
        from jobspy import scrape_jobs
        jobs_df = scrape_jobs(
            site_name=[site],
            search_term=search_term,
            location="" if is_remote_query else location,
            is_remote=is_remote_query,
            results_wanted=limit,
            hours_old=hours_old,
            country_indeed=country or "worldwide",
            verbose=0,
        )
        results = []
        if jobs_df is not None and not jobs_df.empty:
            jobs_df = jobs_df.fillna("")
            for r in jobs_df.to_dict(orient="records"):
                job_url = str(r.get("job_url", ""))
                results.append({
                    "id": str(r.get("id", "")),
                    "title": str(r.get("title", "")),
                    "company": str(r.get("company", "")),
                    "location": str(r.get("location", "")),
                    "workplace_type": str(r.get("job_type", "Full-time")),
                    "job_url": job_url,
                    "description": str(r.get("description", "")),
                    "site": site,
                    "date_posted": str(r.get("date_posted", "")),
                })
        print(f"  [{site}] {len(results)} results for '{search_term}' in '{location}'", file=sys.stderr)
        return results
    except Exception as e:
        print(f"  [{site}] ERROR: {e}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description="Multi-board job scraper using python-jobspy")
    parser.add_argument("--search", type=str, required=True, help="Primary search term")
    parser.add_argument("--searches", type=str, default="", help="JSON array of extra search terms")
    parser.add_argument("--location", type=str, default="", help="Location search filter")
    parser.add_argument("--locations", type=str, default="", help="JSON array of extra locations")
    parser.add_argument("--limit", type=int, default=10, help="Results per site per search")
    parser.add_argument("--hours", type=int, default=336, help="Max hours old (default 336 = 2 weeks)")
    parser.add_argument("--country", type=str, default="uk", help="Default country for Indeed")
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

    # Target the working high-yield live boards in JobSpy
    sites = ["linkedin", "indeed"]

    all_results = []
    seen_urls = set()

    print(f"Scraping {len(sites)} boards across {len(search_terms)} target roles and {len(locations)} locations...", file=sys.stderr)

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
