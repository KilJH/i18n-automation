import { GoogleSpreadsheet } from 'google-spreadsheet';

// place in translate/upload.js
import fs from 'fs';
import {
  loadSpreadsheet,
  localesPath,
  getPureKey,
  ns,
  lngs,
  sheetId,
  columnKeyToHeader,
  NOT_AVAILABLE_CELL,
} from './index';

type LanguageMap = {
  [lng: string]: string;
};

type KeyMapWithLng = {
  [key: string]: LanguageMap;
};

type KeyMap = {
  [key: string]: KeyMapWithLng;
};

type Row = {
  [key: string]: string;
};

type OriginMap = {
  [key: string]: string | OriginMap;
};

const headerValues = ['Key', '한글', '영어', '일본어'];

async function addNewSheet(
  doc: GoogleSpreadsheet,
  title: string,
  // sheetId: number,
) {
  const sheet = await doc.addSheet({
    // sheetId,
    title,
    headerValues,
  });

  return sheet;
}

async function updateTranslationsFromKeyMapToSheet(
  doc: GoogleSpreadsheet,
  keyMap: KeyMapWithLng,
) {
  const title = 'Translate Sheet'; // Sheet Name
  let sheet = doc.sheetsById[sheetId];
  if (!sheet) {
    sheet = await addNewSheet(doc, title);
  }

  const rows = await sheet.getRows();

  // find exsit keys
  const existKeys: { [key: string]: boolean } = {};
  const addedRows: Row[] = [];
  rows.forEach(row => {
    const key = row[columnKeyToHeader.key];
    if (keyMap[key]) {
      existKeys[key] = true;
    }
  });

  for (const [key, translations] of Object.entries(keyMap)) {
    if (!existKeys[key]) {
      const row = {
        [columnKeyToHeader.key]: key,
        ...Object.keys(translations).reduce((result: LanguageMap, lng) => {
          const header: string = columnKeyToHeader[lng];
          result[header] = translations[lng];
          return result;
        }, {}),
      };

      addedRows.push(row);
    }
  }

  // upload new keys
  await sheet.addRows(addedRows);
}

function toJson(keyMap: KeyMap) {
  const json: KeyMapWithLng = {};

  Object.entries(keyMap).forEach(([__, keysByPlural]) => {
    for (const [keyWithPostfix, translations] of Object.entries(keysByPlural)) {
      json[keyWithPostfix] = {
        ...translations,
      };
    }
  });

  return json;
}

function gatherKeyMap(keyMap: KeyMap, lng: string, json: OriginMap) {
  const updateSheetWithDeepkey = (key: string, value: string | OriginMap) => {
    if (typeof value === 'object') {
      const keys = Object.keys(value); // object sub keys
      keys.forEach(subKey =>
        updateSheetWithDeepkey(key + '.' + subKey, value[subKey]),
      );
    } else {
      // 기존 언어별 컬럼 매핑
      if (!keyMap[key]) {
        keyMap[key] = {};
      }

      const keyMapWithLng = keyMap[key];
      if (!keyMapWithLng[key]) {
        keyMapWithLng[key] = lngs.reduce(
          (initObj: LanguageMap, lng: string) => {
            initObj[lng] = NOT_AVAILABLE_CELL;

            return initObj;
          },
          {},
        );
      }

      keyMapWithLng[key][lng] = value;
    }
  };

  for (const [keyWithPostfix, translated] of Object.entries(json)) {
    updateSheetWithDeepkey(keyWithPostfix, translated);
  }
}

async function updateSheetFromJson() {
  const doc = await loadSpreadsheet();

  fs.readdir(localesPath, (error, lngs) => {
    if (error) {
      throw error;
    }

    const keyMap: KeyMap = {};

    lngs.forEach(lng => {
      const localeJsonFilePath = `${localesPath}/${lng}/${ns}.json`;

      // eslint-disable-next-line no-sync
      const json = fs.readFileSync(localeJsonFilePath, 'utf8');

      gatherKeyMap(keyMap, lng, JSON.parse(json));
    });

    updateTranslationsFromKeyMapToSheet(doc, toJson(keyMap));
  });
}

updateSheetFromJson();
