import { defineStore } from 'pinia'
import AHP from 'ahp'
import { Attribute, useUseCase } from './useCase'
import { useProcess } from './process'
import { useStrategic } from './strategic'
import * as _ from 'lodash'

interface Item {
  label: string
  weight: number
  score?: number
}

interface Category {
  id: number
  label: string
  weight: number
  score: number
  items?: Array<Item>
  categories?: Array<Category>
}

interface CategoryPair {
  layer: string
  category1: Category
  category2: Category
  importance: number
}

type PairWeighting = [string, string, number]

export const useConfig = defineStore('config', {
  state: () => {
    return {
      activeTab: 'UseCaseManager',
      useCaseEditMode: false,
      useCaseForm: false,
      useCaseFormCache: {
        id: Number,
        label: '',
        useCaseState: 0,
        processId: Number,
        processLabel: '',
        categories: [] as Category[],
      },
      categoryTemplate: [
        {
          label: 'Strategic goals',
          items: [
            { label: 'Goal1', score: 3 },
            { label: 'Goal2', score: 3 },
            { label: 'Goal3', score: 3 },
          ] as Item[],
        } as Category,
        {
          label: 'Risk minimization',
          categories: [{
            label: 'Challenges and issues',
            items: [
              { label: 'Involvement of external partners', score: 3 },
              { label: 'Deviations / process variants', score: 3 },
              { label: 'Processual weaknesses', score: 3 },
            ] as Item[],
          },
          {
            label: 'State of data',
            items: [
              { label: 'Availability of data', score: 3 },
              { label: 'Data quality', score: 3 },
            ] as Item[],
          },
          {
            label: 'Organizational support',
            items: [
              { label: 'Management support', score: 3 },
              { label: 'Department support', score: 3 },
              { label: 'Employee support', score: 3 },
            ] as Item[],
          },
          {
            label: 'Skills and capabilities',
            items: [
              { label: 'Technological skills', score: 3 },
              { label: 'analytical skills', score: 3 },
              { label: 'Process expertise', score: 3 },
            ] as Item[],
          }] as Category[],
        } as Category,
        {
          label: 'Value potential',
          items: [
            { label: 'Time', score: 3 },
            { label: 'Cost', score: 3 },
            { label: 'Quality', score: 3 },
            { label: 'Flexibility', score: 3 },
          ] as Item[],
        } as Category,
      ],
    }
  },
  actions: {
    resetCache () {
      this.useCaseEditMode = false
      this.useCaseForm = false
      this.processLabel = ''
      this.useCaseState = 0
      this.useCaseFormCache = {
        id: Number,
        label: '',
        processId: Number,
        categories: [] as Category[],
      }
    },
    setUseCase () {
      const items = [] as Array<Attribute>
      this.useCaseFormCache.categories.forEach(category => {
        if (category.items === undefined) {
          category.categories.forEach(subcategory => {
            subcategory.items.forEach(item => {
              items.push({ label: item.label, score: item.score } as Attribute)
            })
          })
        } else {
          category.items.forEach(item => {
            items.push({ label: item.label, score: item.score } as Attribute)
          })
        }
      })
      if (this.useCaseFormCache.id >= 0) {
        useUseCase().setUseCase(
          this.useCaseFormCache.label,
          useProcess().getIdByLabel(this.useCaseFormCache.processLabel),
          this.useCaseFormCache.state,
          items,
          this.useCaseFormCache.id
        )
      } else {
        useUseCase().setUseCase(
          this.useCaseFormCache.label,
          useProcess().getIdByLabel(this.useCaseFormCache.processLabel),
          this.useCaseFormCache.state,
          items
        )
      }
      this.resetCache()
    },
    setActiveTab (tab) {
      this.activeTab = tab
    },
    setUseCaseForm (id?: number) {
      if (id === undefined) {
        this.useCaseFormCache.categories = _.cloneDeep(this.categoryTemplate)
      } else {
        this.useCaseEditMode = true
        this.useCaseFormCache.id = id
        this.useCaseFormCache.state = useUseCase().getStateById(id)
        this.useCaseFormCache.label = useUseCase().getLabelById(id)
        this.useCaseFormCache.processId = useUseCase().getProcessIdById(id)
        this.useCaseFormCache.processLabel = useProcess().getLabelById(this.useCaseFormCache.processId)
        const categories = _.cloneDeep(this.categoryTemplate)
        categories.forEach(category => {
          if (category.items === undefined) {
            category.categories.forEach(subcategory => {
              subcategory.items.forEach(item2 => {
                item2.score = _.cloneDeep(useUseCase().getUseCaseById(id).items.filter(item => item.label === item2.label)[0].score)
              })
            })
          } else {
            category.items.forEach(item2 => {
              item2.score = _.cloneDeep(useUseCase().getUseCaseById(id).items.filter(item => item.label === item2.label)[0].score)
            })
          }
        })
        this.useCaseFormCache.categories = categories
      }
      this.useCaseForm = true
    },
    setEditableProcess (id) {
      this.editableProcess = id
    },
    getAHPWeights (categoryLabels, categoryPairs: CategoryPair[]) {
      const pairWeighting: PairWeighting[] = []
      categoryPairs.forEach(pair => {
        if (pair.importance === 8) {
          pairWeighting.push([
            pair.category1.label,
            pair.category2.label,
            1,
          ])
        } else if (pair.importance < 8) {
          pairWeighting.push([
            pair.category1.label,
            pair.category2.label,
            9 - pair.importance,
          ])
        } else {
          pairWeighting.push([
            pair.category1.label,
            pair.category2.label,
            1 / (pair.importance - 7),
          ])
        }
      })
      const ahpContext = new AHP()
      ahpContext.addCriteria(categoryLabels)
      ahpContext.rankCriteria(pairWeighting)
      const critWeightVector = AHP.calculateMatrixConsistency(ahpContext.criteriaRank).weightedVector
      return critWeightVector
    },
    getAttributeScore (attributes: Array<Attribute>, label: string) {
      return attributes.filter(attribute => attribute.label === label)[0].score
    },
    updateScores () {
      useUseCase().useCases.forEach(useCase => {
        useUseCase().setScores(useCase.id)
      })
    },
    calculateRating (attributes: Array<Attribute>, processId: number) {
      let score = 0
      let weightCache = 0
      let strategicScore = 0
      useStrategic().categories[0].items?.forEach(item => {
        strategicScore = strategicScore + item.weight * this.getAttributeScore(attributes, item.label)
        weightCache = weightCache + item.weight
      })
      strategicScore = strategicScore / weightCache
      weightCache = 0
      let riskScore = 0
      useStrategic().categories[1].categories?.forEach(category => {
        let subcategoryScore = 0
        category.items?.forEach(item => {
          subcategoryScore = subcategoryScore + item.weight * this.getAttributeScore(attributes, item.label)
          weightCache = weightCache + item.weight
        })
        subcategoryScore = subcategoryScore / weightCache
        weightCache = 0
        riskScore = riskScore + subcategoryScore * category.weight
      })
      let valueScore = 0
      weightCache = 0
      useStrategic().categories[2].items?.forEach(item => {
        valueScore = valueScore + useProcess().getWeight(processId, item.label) * this.getAttributeScore(attributes, item.label)
        weightCache = weightCache + useProcess().getWeight(processId, item.label)
      })
      valueScore = valueScore / weightCache
      score = (strategicScore * useStrategic().categories[0].weight +
        riskScore * useStrategic().categories[1].weight * useStrategic().categories[1].riskFactor +
        valueScore * useStrategic().categories[2].weight) / (
        useStrategic().categories[0].weight +
        useStrategic().categories[1].weight * useStrategic().categories[1].riskFactor +
        useStrategic().categories[2].weight)
      const subScores = [
        { label: 'Strategic goals', score: strategicScore },
        { label: 'Risk minimization', score: riskScore },
        { label: 'Value potential', score: valueScore }]
      return { score, subScores }
    },
    persist: true,
  },
})
