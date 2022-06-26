// place in translate/download.js
const fs = require("fs");
const mkdirp = require("mkdirp");
const {
  loadSpreadsheet,
  localesPath,
  ns,
  lngs,
  sheetId,
  columnKeyToHeader,
  NOT_AVAILABLE_CELL,
} = require("./index");

/**
 * fetch translations from google spread sheet and transform to json
 * @param {GoogleSpreadsheet} doc GoogleSpreadsheet document
 * @returns [object] translation map
 * {
 *   "ko-KR": {
 *     "key": "value"
 *   },
 *   "en-US": {
 *     "key": "value"
 *   },
 *   "ja-JP": {
 *     "key": "value"
 *   },
 * }
 */
async function fetchTranslationsFromSheetToJson(doc) {
  const sheet = doc.sheetsById[sheetId];
  if (!sheet) {
    return {};
  }

  const lngsMap = {};
  const rows = await sheet.getRows();

  rows.forEach((row) => {
    const key = row[columnKeyToHeader.key];
    const keyDepth = key.split(".");
    const depth = keyDepth.length;

    lngs.forEach((lng) => {
      const translation = row[columnKeyToHeader[lng]];
      // NOT_AVAILABLE_CELL("_N/A") means no related language
      if (translation === NOT_AVAILABLE_CELL) {
        return;
      }

      if (!lngsMap[lng]) {
        lngsMap[lng] = {};
      }

      let translateWithDepth = lngsMap[lng];
      // depth 처리
      for (let i = 0; i < depth; i += 1) {
        if (!translateWithDepth[keyDepth[i]]) {
          translateWithDepth[keyDepth[i]] = {};
        }

        if (i === depth - 1) {
          translateWithDepth[keyDepth[i]] = translation || "";
          return;
        }

        translateWithDepth = translateWithDepth[keyDepth[i]];
      }

      // lngsMap[lng][key] = translation || ""; // prevent to remove undefined value like ({"key": undefined})
    });
  });

  return lngsMap;
}

function checkAndMakeLocaleDir(dirPath, subDirs) {
  return new Promise((resolve) => {
    subDirs.forEach((subDir, index) => {
      mkdirp(`${dirPath}/${subDir}`);
      if (index === subDirs.length - 1) {
        resolve();
      }
    });
  });
}

async function updateJsonFromSheet() {
  await checkAndMakeLocaleDir(localesPath, lngs);

  const doc = await loadSpreadsheet();
  const lngsMap = await fetchTranslationsFromSheetToJson(doc);

  fs.readdir(localesPath, (error, lngs) => {
    if (error) {
      throw error;
    }

    lngs.forEach((lng) => {
      const localeJsonFilePath = `${localesPath}/${lng}/${ns}.json`;

      const jsonString = JSON.stringify(lngsMap[lng], null, 2);

      fs.writeFile(localeJsonFilePath, jsonString, "utf8", (err) => {
        if (err) {
          throw err;
        }
      });
    });
  });
}

updateJsonFromSheet();
