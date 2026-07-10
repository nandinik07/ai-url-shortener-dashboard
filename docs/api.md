# REST API Documentation

All administrative REST APIs are prefix-mounted under `/api` (e.g. `http://localhost:5000/api/...`), except for the core redirect endpoint which is mounted at the root (`/r/:shortCode`).

---

## 1. Redirection Endpoint

### Redirect Short Code / Alias
* **Endpoint:** `GET /r/:shortCode`
* **Description:** Resolves the short code or custom alias, records click analytics in a non-blocking background thread, and immediately redirects the user to the destination.
* **Params:** `shortCode` (string) - The auto-generated short code or custom alias.
* **Success Response:**
  * **Code:** `302 Found`
  * **Headers:** `Location: <original_url>`
* **Error Responses:**
  * **Code:** `403 Forbidden` (Link is disabled/inactive)
  * **Code:** `404 Not Found` (Link does not exist or was deleted)
  * **Code:** `410 Gone` (Link has expired)

---

## 2. Link Management APIs

### Create Short Link
* **Endpoint:** `POST /api/links`
* **Headers:** `Content-Type: application/json`
* **Body Fields:**
  * `title` (string, required) - Campaign title.
  * `original_url` (string, required) - Valid HTTP/HTTPS destination URL.
  * `custom_alias` (string, optional) - Custom alias. Can only contain letters, numbers, dashes, and underscores.
  * `expires_at` (ISO-8601 string, optional) - Future expiration date.
* **Success Response:**
  * **Code:** `201 Created`
  * **Body:**
    ```json
    {
      "status": "success",
      "data": {
        "id": 1,
        "title": "Google Link",
        "original_url": "https://google.com",
        "short_code": "aB3dEf",
        "custom_alias": "my-google-alias",
        "is_active": true,
        "expires_at": "2026-08-01T12:00:00.000Z",
        "created_at": "2026-07-10T16:15:00.000Z",
        "deleted_at": null
      }
    }
    ```
* **Error Responses:**
  * **Code:** `400 Bad Request` (Invalid URL, expiry date in the past, or missing title)
  * **Code:** `409 Conflict` (Custom alias already taken)

### List Short Links (Paginated & Searchable)
* **Endpoint:** `GET /api/links`
* **Query Params:**
  * `page` (number, optional) - Default: `1`
  * `limit` (number, optional) - Default: `10`
  * `search` (string, optional) - Text filter matching title or original URL.
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:**
    ```json
    {
      "status": "success",
      "data": {
        "links": [
          {
            "id": 1,
            "title": "Google Link",
            "original_url": "https://google.com",
            "short_code": "aB3dEf",
            "custom_alias": "my-google-alias",
            "is_active": true,
            "expires_at": null,
            "created_at": "2026-07-10T16:15:00.000Z",
            "deleted_at": null,
            "click_count": 42
          }
        ],
        "pagination": {
          "page": 1,
          "limit": 10,
          "total": 1,
          "pages": 1
        }
      }
    }
    ```

### Get Link Details
* **Endpoint:** `GET /api/links/:id`
* **Params:** `id` (integer) - Link ID.
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:** Same as Link object.
* **Error Responses:**
  * **Code:** `404 Not Found` (Link does not exist or has been deleted)

### Update Short Link
* **Endpoint:** `PATCH /api/links/:id`
* **Params:** `id` (integer) - Link ID.
* **Body Fields (All optional):**
  * `title` (string)
  * `original_url` (string)
  * `custom_alias` (string | null)
  * `expires_at` (ISO-8601 string | null)
  * `is_active` (boolean)
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:** Updated Link object.
* **Error Responses:**
  * **Code:** `400 Bad Request` (Invalid schema)
  * **Code:** `404 Not Found` (Link not found)
  * **Code:** `409 Conflict` (New custom alias is already taken)

### Delete Short Link (Soft Delete)
* **Endpoint:** `DELETE /api/links/:id`
* **Params:** `id` (integer) - Link ID.
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:**
    ```json
    {
      "status": "success",
      "message": "Link successfully deleted (soft delete)"
    }
    ```
* **Error Responses:**
  * **Code:** `404 Not Found` (Link not found)

---

## 3. Analytics & AI APIs

### Suggest Custom Aliases
* **Endpoint:** `POST /api/links/suggest-aliases`
* **Body:**
  * `original_url` (string, required) - The destination URL.
  * `title` (string, optional) - Campaign title.
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:**
    ```json
    {
      "status": "success",
      "data": {
        "suggestions": [
          "summer-sale",
          "discount-items",
          "promo-code"
        ]
      }
    }
    ```

### Get Dashboard Stats
* **Endpoint:** `GET /api/analytics/dashboard`
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:**
    ```json
    {
      "status": "success",
      "data": {
        "totalLinks": 15,
        "totalClicks": 348,
        "activeLinks": 12,
        "expiredLinks": 3
      }
    }
    ```

### Get Link Analytics Details
* **Endpoint:** `GET /api/analytics/links/:linkId`
* **Params:** `linkId` (integer) - Link ID.
* **Success Response:**
  * **Code:** `200 OK`
  * **Body:**
    ```json
    {
      "status": "success",
      "data": {
        "link": { ... },
        "totalClicks": 12,
        "clicksByDate": [
          { "date": "2026-07-09", "count": 5 },
          { "date": "2026-07-10", "count": 7 }
        ],
        "clicksByBrowser": [
          { "browser": "Chrome", "count": 8 },
          { "browser": "Firefox", "count": 4 }
        ],
        "clicksByOS": [
          { "os": "Windows", "count": 7 },
          { "os": "macOS", "count": 5 }
        ],
        "clicksByCountry": [
          { "country": "United States", "count": 6 },
          { "country": "India", "count": 4 },
          { "country": "Canada", "count": 2 }
        ],
        "clicksByReferrer": [
          { "referrer": "twitter.com", "count": 5 },
          { "referrer": "linkedin.com", "count": 4 },
          { "referrer": "Direct", "count": 3 }
        ]
      }
    }
    ```
