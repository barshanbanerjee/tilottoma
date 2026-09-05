# Contributing to Kolkata Street History

Welcome to **Kolkata Street History**.

This is an open-source project dedicated to documenting the history behind the streets of Kolkata — their names, former names, origins, renamings, stories, and the historical events connected to them.

The project uses **Google Maps** as its map foundation. The goal is not to build another mapping service, but to add a historical layer to the everyday map experience.

> **Google Maps tells you where a street is.
> We want to tell you why it is called that.**

---

## Current Scope

The project is currently focused **only on streets in Kolkata**.

### Currently supported

* Street names
* Historical/former street names
* Origin of street names
* Street history
* Historical dates and events
* Sources and references
* Community corrections
* Historical photographs where legally permitted

### Not currently supported

The following may be introduced in future versions:

* Buildings
* Monuments
* Individual landmarks
* Neighbourhoods
* Historical walks
* Historical map layers
* Other cities
* Other countries

Please keep contributions focused on **Kolkata streets** for now.

---

# How Contributions Work

The project is community-driven, but historical information is reviewed before publication.

A contribution follows this process:

```text
User Contribution
       │
       ▼
   Under Review
       │
   ┌───┴────┐
   ▼        ▼
Approved  Rejected
   │
   ▼
Published
```

Submitting information does **not** immediately modify the public record.

An administrator or authorised moderator reviews contributions before they are published.

---

# What You Can Contribute

You can contribute information such as:

### Historical Names

For example:

> This street was previously known as ______.

### Name Origins

For example:

> The street is believed to have been named after ______.

### Renamings

For example:

> The street was renamed from ______ to ______ around ______.

### Historical Events

For example:

> An important historical event associated with this street occurred in ______.

### Corrections

If existing information is inaccurate or incomplete, you can suggest a correction.

### Sources

Reliable references are particularly valuable.

### Historical Photographs

You may contribute photographs when you have the right to share them.

---

# Sources and Accuracy

Historical information should be supported by reliable sources whenever possible.

Useful sources include:

* Books
* Academic publications
* Government records
* Archives
* Newspapers
* Museums
* Historical societies
* University publications
* Reliable institutional websites
* Digitised historical documents

When submitting a historical claim, provide the source that supports it.

For example:

```text
Title: Calcutta: The Living City
Author: Example Author
Publisher: Example Publisher
Year: 1990
Page: 125
```

For an online source:

```text
Title: History of Park Street
Publisher: Example Institution
URL: https://example.com
Publication Date: 2020
```

---

# Don't Guess

Historical information can sometimes be uncertain or disputed.

Do not present assumptions as facts.

Instead of:

> The street was definitely named after X in 1850.

prefer:

> Some historical sources suggest that the street was named after X around the mid-19th century.

If there are multiple credible explanations, document them.

For example:

> Sources differ regarding the origin of the street's name. Source A attributes the name to X, while Source B suggests Y.

The purpose of this project is to **document history accurately**, not to create artificial certainty.

---

# Corrections

If you find something wrong, please submit a correction instead of attempting to bypass the contribution system.

A useful correction should include:

1. The information currently displayed.
2. What you believe is incorrect.
3. The corrected information.
4. An explanation.
5. A source, if available.

Example:

```text
Current:
The street was renamed in 1950.

Suggested correction:
The street was renamed in 1952.

Reason:
The government notification published in [source]
indicates the change occurred in 1952.

Source:
[reference]
```

---

# Contributions Are Reviewed

Every contribution may be:

* **Approved**
* **Rejected**
* **Returned for clarification**

A contribution may be rejected if:

* It has no credible basis.
* It contains fabricated information.
* The source cannot be verified.
* It duplicates existing information.
* It falls outside the project's current scope.
* It contains copyrighted material that cannot be legally used.
* It is submitted in bad faith.

---

# Photographs and Copyright

Only upload photographs or other media that you have permission to share.

Do not upload copyrighted photographs taken from:

* Random websites
* Books
* Newspapers
* Social media
* Archives with restrictive licences

unless their licence or permission allows redistribution.

When possible, provide:

```text
Creator:
Date:
Source:
Licence:
Description:
```

Historical photographs are extremely valuable to the project, but respecting copyright is equally important.

---

# Code Contributions

The project is open source, and contributions to the codebase are welcome.

Before making a significant change:

1. Check existing issues and pull requests.
2. Open an issue if the change is substantial.
3. Explain what you want to change.
4. Keep pull requests focused.

---

# Development Stack

The project is built around:

* Next.js
* React
* TypeScript
* Tailwind CSS
* PostgreSQL
* PostGIS
* Drizzle ORM
* Google Maps Platform

Google Maps is the project's map provider.

Please do not replace Google Maps with another mapping library unless the maintainers explicitly decide to do so.

---

# Development Setup

Clone the repository:

```bash
git clone <repository-url>
cd <project-directory>
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env.local
```

Add the required credentials and configuration.

Start the development server:

```bash
npm run dev
```

The application should then be available at:

```text
http://localhost:3000
```

Refer to the project's setup documentation for the complete environment configuration.

---

# Environment Variables

Never commit API keys, database credentials, or other secrets.

Use environment variables for:

* Google Maps API credentials
* Database connection
* Authentication
* Storage
* Other third-party services

Never commit:

```text
.env
.env.local
```

or any file containing secrets.

---

# Pull Requests

A good pull request should:

* Have a clear purpose.
* Keep changes focused.
* Follow the existing architecture.
* Avoid unnecessary dependencies.
* Include appropriate validation.
* Include documentation when necessary.

Before submitting:

```bash
npm run lint
npm run build
```

Both should pass successfully.

---

# Architecture Principles

The project should remain simple and maintainable.

### Google Maps is the map.

Do not build a replacement mapping system.

### Our database is the historical layer.

Google provides the geographic map experience.

We provide:

* Historical information
* Historical names
* Sources
* Community contributions
* Verification
* Revisions

### Contributions are separate from published data.

User submissions should go through review before becoming part of the published historical record.

### Preserve history.

Changes should be traceable.

Whenever practical, the project should maintain a revision history showing what changed and when.

---

# Community Guidelines

Historical topics can sometimes involve political, cultural, religious, social, or other sensitive subjects.

Disagreement is acceptable.

Personal attacks are not.

Please:

* Be respectful.
* Discuss sources rather than attacking contributors.
* Avoid deliberate misinformation.
* Do not vandalise historical records.
* Do not submit AI-generated historical claims without verification.
* Be transparent when information is uncertain.

---

# AI-Assisted Contributions

AI tools may be used to help research, organise, or draft contributions.

However, **AI-generated information is not considered a source**.

Do not submit a historical claim simply because an AI model generated it.

Verify important information against reliable sources before contributing it.

If AI was used to help prepare a contribution, the contributor remains responsible for the accuracy of the submitted information.

---

# Future Direction

Kolkata is only the beginning.

The long-term vision is to create a community-maintained historical layer that can eventually expand beyond streets and beyond Kolkata.

Possible future additions include:

```text
Streets
   ↓
Buildings
   ↓
Landmarks
   ↓
Neighbourhoods
   ↓
Historical events
   ↓
Historical walks
   ↓
Other cities
   ↓
Other regions
```

But the foundation starts with something simple:

> **Every street has a story.**

Help us document it.
