export const OCR_ENGINE_LOCK = Object.freeze({
  sourceRevision: "2661c7c0ef5c613e8f93c6e93b2e052399f0f854",
  paddleOcrVersion: "3.7.0",
  paddleRuntimeVersion: "3.3.1",
  containerBase: "python:3.12.10-slim-bookworm@sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4",
  models: [
    {
      name: "PP-OCRv5_mobile_det",
      revision: "0d63e78e2b680928f6b1747d76a08db6e645efb7",
      weightBytes: 4_692_937,
      weightSha256: "afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b"
    },
    {
      name: "en_PP-OCRv5_mobile_rec",
      revision: "267c36e24c331595590fe7bd72bde2436fd286f2",
      weightBytes: 7_772_315,
      weightSha256: "3ec8a97ed6cefe8568d3e2ee90bb193299b566a7661aa4fd52d224b96b59f66b"
    },
    {
      name: "devanagari_PP-OCRv5_mobile_rec",
      revision: "99dcce6d196bd4aaf268c7a5c72c3cc9f3ea4932",
      weightBytes: 7_836_203,
      weightSha256: "719be7d20bfe9530e2deae324c999e9911087496bce5e70846767c448d023a01"
    },
    {
      name: "te_PP-OCRv5_mobile_rec",
      revision: "151ab3b1c2f2a058f07a944416b92e9eaec6bf36",
      weightBytes: 7_822_651,
      weightSha256: "45967d00d6b4af590221733bf0d93791babc1feb17b98da401dba53d3cf110c9"
    }
  ]
});

export function exactOcrModelReceipt(receipt: Array<{ name: string; revision: string; weightSha256: string }>) {
  if (receipt.length !== OCR_ENGINE_LOCK.models.length) return false;
  const actual = [...receipt].sort((left, right) => left.name.localeCompare(right.name));
  const expected = [...OCR_ENGINE_LOCK.models].sort((left, right) => left.name.localeCompare(right.name));
  return expected.every((model, index) => model.name === actual[index]?.name && model.revision === actual[index]?.revision && model.weightSha256 === actual[index]?.weightSha256);
}
