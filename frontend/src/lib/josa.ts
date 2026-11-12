// 한국어 조사(을/를, 와/과): 이름 끝 글자의 받침으로 고릅니다. 한글이 아니면 받침 없음으로 봅니다(예: '손님A를').
const hasBatchim = (word: string) => {
  const code = word.trim().charCodeAt(word.trim().length - 1)
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
}

export const eulReul = (word: string) => `${word}${hasBatchim(word) ? '을' : '를'}`
export const waGwa = (word: string) => `${word}${hasBatchim(word) ? '과' : '와'}`
