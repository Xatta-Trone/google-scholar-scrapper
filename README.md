# Google Scholar Scraper
This project scrapes publication data and metadata from an author's Google Scholar profile. The scraper is currently configured to scrape and update the data of [Dr. Subhasish Das](https://scholar.google.com/citations?view_op=list_works&hl=en&hl=en&user=qK-YgxAAAAAJ&sortby=pubdate) on a daily basis, saving the results to the JSON file `scholar-data-qK-YgxAAAAAJ.json`.

The live preview of the scraped data is available at: https://google-scholar-scrapper.vercel.app.


## Features
- Scrapes title, authors, year, journal, volume, pages, citations, and links to the publication.
- Automatically updates the JSON file with the latest data every day.
- Extracts metadata such as publication date and source URL for each article.
- Ensures duplicate articles are not added during updates.

## TODO List

- [x] Scrap title, author, year, journal etc. 
- [x] Put the data in a json file.
- [x] Set github actions for automation.
- [x] Deploy to vercel.
- [ ] Get the DOI if available. 
- [ ] Filter out false data.
- [ ] Add records with no year available. 

## License 
- MIT license