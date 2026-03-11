// 공유 유틸리티 함수

export * from './serialization';
export * from './url-validator';
export * from './date-utils';
export * from './keyword-extractor';
export * from './feed-parser';

// 유틸리티 함수들을 namespace로 export (import { utils } 패턴 지원)
import * as serializationUtils from './serialization';
import * as urlValidatorUtils from './url-validator';
import * as dateUtils from './date-utils';
import * as keywordExtractorUtils from './keyword-extractor';
import * as feedParserUtils from './feed-parser';

export const utils = {
  ...serializationUtils,
  ...urlValidatorUtils,
  ...dateUtils,
  ...keywordExtractorUtils,
  ...feedParserUtils,
};
