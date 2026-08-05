# Domain Property

Australian property data from [Domain](https://www.domain.com.au) (domain.com.au) — the self-serve property portal API. This plugin connects to the myHub-hosted Domain MCP server and surfaces read-only listings, agency and market data for real estate workflows: prospecting, buyer briefings, appraisal prep and suburb reporting.

The server talks to Domain with your own developer API key, so usage draws on your Domain project's plan and call quota.

## Tools & resources

### Listings
- Search residential listings for sale or rent (suburb, property type, beds/baths/parking, price range, keywords)
- View a single listing's full detail (description, features, media, inspections, advertiser)

### Agencies
- Search agencies by name or suburb
- View an agency's profile, offices and agents
- List an agency's current listings

### Market data
- Latest weekend auction results summary per capital city (clearance rate, sold count, median)
- Individual auction results per city
- Suburb performance statistics (median sold price, sales volume, growth, by house/unit/land)
- Suburb demographics (census-derived)

### Addresses
- Autocomplete a partial address into known properties (requires the *Address Suggestions* package on your Domain project — not part of the free starter packages)

## Widgets

- **Auction pulse** — weekend clearance rate, volumes and median for a capital city
- **Suburb pulse** — median sold price, sales volume and top sale for a target suburb
- **Listings feed** — current for-sale listings in a target suburb

The widgets ship with demo defaults (Sydney / Parramatta NSW) — edit the widget's `dataProvider.params` to target your patch.

## Configuration

This plugin connects to Domain with your developer API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `DOMAIN_API_KEY` | Yes | Your Domain developer API key. Sign up free at [developer.domain.com.au](https://developer.domain.com.au/), create a project (the *Agents & Listings* and *Properties & Locations* packages are attached automatically), and copy the project's API key. |

## Domain API terms — read before shipping client-facing surfaces

Domain's API terms require that anything you build on their data:

- shows **"powered by Domain"** attribution where the data is displayed;
- **links back** to the original listing on domain.com.au (with UTM tags);
- does **not** paywall agent contact details or price-estimate data;
- does **not** persist listing data long-term (Domain pushes ~4,000 listing updates a day — always render from a fresh fetch).

Paid packages (Price Estimation, Rental AVM, Listings Management, Webhooks) are added to a Domain project via Domain's sales team; the connected key picks them up with no plugin change.

## Verification status

Endpoint paths follow Domain's published v1/v2 API surface but the request/response **field names have not yet been verified against a live key** (the connector was built ahead of the first Domain account). Before first production use: connect a real key, run each tool once, and fix any field-name drift — widget bindings (`spec.elements.*`) and the search body mapper are the two places to check.

## See also
- [Domain Developer Portal](https://developer.domain.com.au/)
- [Domain API packages](https://developer.domain.com.au/docs/v1/apis/)
