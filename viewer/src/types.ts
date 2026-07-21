export interface TextIndexRecord {
  index: number;
  name: string;
  nodeOffset: number;
  population: number;
}

export interface LangName {
  lang: string;
  name: string;
}

export interface CityData {
  id: number;
  lat: number;
  lng: number;
  population: number;
  elevation: number;
  dem: number;
  name: string;
  asciiName: string;
  alternatenames: string;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  cc2: string;
  admin1: string;
  admin2: string;
  admin3: string;
  admin4: string;
  timezone: string;
  modificationDate: string;
  vernacular: LangName[];
  provinceName: string;
  countryName: string;
  utcOffsetSeconds: number;
  utcOffsetUnknown: boolean;
  provinceIsoCode: string;
  provinceType: string;
  provinceWikidataId: string;
  provinceNames: LangName[];
}

export interface KdNode {
  offset: number;
  nodeType: number;
  lat: number;
  lng: number;
  axis: number;
  cityDataLen: number;
  cityDataOffset: number;
  left: number;
  right: number;
}

/** Node skeleton + decoded city. */
export interface KdNodeRecord extends KdNode {
  city: CityData;
}
