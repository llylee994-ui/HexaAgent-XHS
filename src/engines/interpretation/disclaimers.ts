const BASE_DISCLAIMER = '本工具仅供传统文化研究与娱乐参考，不构成任何专业建议或结果承诺。'

/** 按问题类别输出的免责与提示文案；健康、法律、财务必须醒目提示 */
export function disclaimersFor(category: string): readonly string[] {
  switch (category) {
    case 'health':
      return [
        BASE_DISCLAIMER,
        '健康问题请务必咨询专业医疗机构，卦象内容不能替代医疗诊断与治疗意见。',
      ]
    case 'dispute':
      return [
        BASE_DISCLAIMER,
        '法律纠纷请咨询执业律师，卦象内容不能替代法律意见。',
      ]
    case 'wealth':
      return [
        BASE_DISCLAIMER,
        '财务与投资决策请咨询持牌专业人士，卦象内容不能替代专业财务建议。',
      ]
    default:
      return [BASE_DISCLAIMER]
  }
}
