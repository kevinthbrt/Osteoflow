'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, FileText, Image, Plus, Save, Trash2, X } from 'lucide-react'

interface Subpart {
  id?: string
  tempId: string
  title: string
  vimeoUrl: string
  descriptionHtml: string
  pdfUrl: string
  pdfName: string
  orderIndex: number
}

interface Chapter {
  id?: string
  tempId: string
  title: string
  orderIndex: number
  subparts: Subpart[]
}

interface FormationData {
  id?: string
  title: string
  description: string
  isPrivate: boolean
  isFreeAccess: boolean
  isFeaturedOsteoflow: boolean
  photoUrl?: string
  chapters: Chapter[]
}

interface ExistingFormation {
  id: string
  title: string
  description?: string
  is_private?: boolean
  is_free_access?: boolean
  is_featured_osteoflow?: boolean
  photo_url?: string
  chapters: Array<{
    id: string
    title: string
    order_index?: number
    subparts: Array<{
      id: string
      title: string
      vimeo_url?: string
      description_html?: string
      pdf_url?: string
      pdf_name?: string
      order_index?: number
    }>
  }>
}

interface Props {
  onClose: () => void
  onSuccess: () => void
  existingFormation?: ExistingFormation
}

export default function CourseCreationWizard({ onClose, onSuccess, existingFormation }: Props) {
  const supabase = createClientComponentClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [uploadingPdfSubpartId, setUploadingPdfSubpartId] = useState<string | null>(null)

  const [formation, setFormation] = useState<FormationData>({
    title: '',
    description: '',
    isPrivate: false,
    isFreeAccess: false,
    isFeaturedOsteoflow: false,
    photoUrl: '',
    chapters: []
  })

  useEffect(() => {
    if (existingFormation) {
      const allChapterIds = new Set<string>()
      const allSubpartIds = new Set<string>()

      setFormation({
        id: existingFormation.id,
        title: existingFormation.title,
        description: existingFormation.description || '',
        isPrivate: existingFormation.is_private || false,
        isFreeAccess: existingFormation.is_free_access || false,
        isFeaturedOsteoflow: existingFormation.is_featured_osteoflow || false,
        photoUrl: existingFormation.photo_url || '',
        chapters: existingFormation.chapters.map(chapter => {
          allChapterIds.add(chapter.id)
          return {
            id: chapter.id,
            tempId: chapter.id,
            title: chapter.title,
            orderIndex: chapter.order_index || 0,
            subparts: chapter.subparts.map(subpart => {
              allSubpartIds.add(subpart.id)
              return {
                id: subpart.id,
                tempId: subpart.id,
                title: subpart.title,
                vimeoUrl: subpart.vimeo_url || '',
                descriptionHtml: subpart.description_html || '',
                pdfUrl: subpart.pdf_url || '',
                pdfName: subpart.pdf_name || '',
                orderIndex: subpart.order_index || 0
              }
            })
          }
        })
      })

      setExpandedChapters(allChapterIds)
      setExpandedSubparts(allSubpartIds)
    }
  }, [existingFormation])

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [expandedSubparts, setExpandedSubparts] = useState<Set<string>>(new Set())

  const toggleChapter = (tempId: string) => {
    const newExpanded = new Set(expandedChapters)
    if (newExpanded.has(tempId)) newExpanded.delete(tempId)
    else newExpanded.add(tempId)
    setExpandedChapters(newExpanded)
  }

  const toggleSubpart = (tempId: string) => {
    const newExpanded = new Set(expandedSubparts)
    if (newExpanded.has(tempId)) newExpanded.delete(tempId)
    else newExpanded.add(tempId)
    setExpandedSubparts(newExpanded)
  }

  const uploadCourseImage = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/course-image-upload', { method: 'POST', body: formData })
    if (!response.ok) throw new Error('Le téléchargement a échoué')
    const data = await response.json()
    return data.url as string
  }

  const uploadCoursePdf = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/course-pdf-upload', { method: 'POST', body: formData })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Le téléversement du PDF a échoué')
    }
    const data = await response.json()
    return { url: data.url as string, name: data.name as string }
  }

  const handleSubpartPdfChange = async (
    chapterTempId: string,
    subpartTempId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingPdfSubpartId(subpartTempId)
    try {
      const { url, name } = await uploadCoursePdf(file)
      setFormation((prev) => ({
        ...prev,
        chapters: prev.chapters.map((c) => {
          if (c.tempId !== chapterTempId) return c
          return {
            ...c,
            subparts: c.subparts.map((s) =>
              s.tempId === subpartTempId ? { ...s, pdfUrl: url, pdfName: name } : s
            )
          }
        })
      }))
    } catch (err: any) {
      console.error("Erreur lors de l'upload du PDF de la sous-partie:", err)
      alert(err?.message || 'Impossible de téléverser le PDF pour le moment. Merci de réessayer plus tard.')
    } finally {
      setUploadingPdfSubpartId(null)
      event.target.value = ''
    }
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploadingPhoto(true)
    try {
      const imageUrl = await uploadCourseImage(file)
      setFormation((prev) => ({ ...prev, photoUrl: imageUrl }))
    } catch (err) {
      console.error("Erreur lors de l'upload de la photo de formation:", err)
      alert("Impossible de téléverser la photo pour le moment. Merci de réessayer plus tard.")
    } finally {
      setIsUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const addChapter = () => {
    const tempId = `chapter-${Date.now()}`
    setFormation({ ...formation, chapters: [...formation.chapters, { tempId, title: '', orderIndex: formation.chapters.length, subparts: [] }] })
    setExpandedChapters(new Set([...Array.from(expandedChapters), tempId]))
  }

  const removeChapter = (tempId: string) => {
    setFormation({ ...formation, chapters: formation.chapters.filter(c => c.tempId !== tempId).map((c, idx) => ({ ...c, orderIndex: idx })) })
  }

  const moveChapter = (tempId: string, direction: 'up' | 'down') => {
    const currentIndex = formation.chapters.findIndex(chapter => chapter.tempId === tempId)
    if (currentIndex === -1) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= formation.chapters.length) return
    const reordered = [...formation.chapters]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, moved)
    setFormation({ ...formation, chapters: reordered.map((chapter, idx) => ({ ...chapter, orderIndex: idx })) })
  }

  const updateChapter = (tempId: string, field: keyof Chapter, value: any) => {
    setFormation({ ...formation, chapters: formation.chapters.map(c => c.tempId === tempId ? { ...c, [field]: value } : c) })
  }

  const addSubpart = (chapterTempId: string) => {
    const tempId = `subpart-${Date.now()}`
    setFormation({
      ...formation,
      chapters: formation.chapters.map(c => {
        if (c.tempId === chapterTempId) {
          return { ...c, subparts: [...c.subparts, { tempId, title: '', vimeoUrl: '', descriptionHtml: '', pdfUrl: '', pdfName: '', orderIndex: c.subparts.length }] }
        }
        return c
      })
    })
    setExpandedSubparts(new Set([...Array.from(expandedSubparts), tempId]))
  }

  const removeSubpart = (chapterTempId: string, subpartTempId: string) => {
    setFormation({
      ...formation,
      chapters: formation.chapters.map(c => {
        if (c.tempId === chapterTempId) {
          return { ...c, subparts: c.subparts.filter(s => s.tempId !== subpartTempId).map((s, idx) => ({ ...s, orderIndex: idx })) }
        }
        return c
      })
    })
  }

  const updateSubpart = (chapterTempId: string, subpartTempId: string, field: keyof Subpart, value: any) => {
    setFormation({
      ...formation,
      chapters: formation.chapters.map(c => {
        if (c.tempId === chapterTempId) {
          return { ...c, subparts: c.subparts.map(s => s.tempId === subpartTempId ? { ...s, [field]: value } : s) }
        }
        return c
      })
    })
  }

  const validate = (): string | null => {
    if (!formation.title.trim()) return 'Le titre de la formation est obligatoire'
    if (formation.chapters.length === 0) return 'Ajoutez au moins un chapitre'
    for (let i = 0; i < formation.chapters.length; i++) {
      const chapter = formation.chapters[i]
      if (!chapter.title.trim()) return `Le chapitre ${i + 1} doit avoir un titre`
      if (chapter.subparts.length === 0) return `Le chapitre "${chapter.title}" doit avoir au moins une sous-partie`
      for (let j = 0; j < chapter.subparts.length; j++) {
        if (!chapter.subparts[j].title.trim()) return `La sous-partie ${j + 1} du chapitre "${chapter.title}" doit avoir un titre`
      }
    }
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError(null)

    try {
      let formationId: string

      if (formation.id) {
        formationId = formation.id

        if (formation.isFeaturedOsteoflow) {
          await supabase.from('elearning_formations')
            .update({ is_featured_osteoflow: false })
            .eq('is_featured_osteoflow', true)
            .neq('id', formationId)
        }

        const { error: formationError } = await supabase
          .from('elearning_formations')
          .update({
            title: formation.title,
            description: formation.description,
            is_private: formation.isPrivate,
            is_free_access: formation.isFreeAccess,
            is_featured_osteoflow: formation.isFeaturedOsteoflow,
            photo_url: formation.photoUrl || null
          })
          .eq('id', formationId)

        if (formationError) throw formationError

        const { data: existingChapters } = await supabase
          .from('elearning_chapters')
          .select('id, subparts:elearning_subparts(id)')
          .eq('formation_id', formationId)

        const currentChapterIds = formation.chapters.filter(c => c.id).map(c => c.id!)
        const chaptersToDelete = existingChapters?.filter(ec => !currentChapterIds.includes(ec.id)) || []

        for (const chapter of chaptersToDelete) {
          await supabase.from('elearning_chapters').delete().eq('id', chapter.id)
        }

        for (const chapter of formation.chapters) {
          let chapterId: string

          if (chapter.id) {
            chapterId = chapter.id
            const { error: chapterError } = await supabase
              .from('elearning_chapters')
              .update({ title: chapter.title, order_index: chapter.orderIndex })
              .eq('id', chapterId)
            if (chapterError) throw chapterError

            const { data: existingSubparts } = await supabase.from('elearning_subparts').select('id').eq('chapter_id', chapterId)
            const currentSubpartIds = chapter.subparts.filter(s => s.id).map(s => s.id!)
            const subpartsToDelete = existingSubparts?.filter(es => !currentSubpartIds.includes(es.id)) || []
            for (const subpart of subpartsToDelete) {
              await supabase.from('elearning_subparts').delete().eq('id', subpart.id)
            }
          } else {
            const { data: chapterData, error: chapterError } = await supabase
              .from('elearning_chapters')
              .insert({ formation_id: formationId, title: chapter.title, order_index: chapter.orderIndex })
              .select().single()
            if (chapterError) throw chapterError
            chapterId = chapterData.id
          }

          for (const subpart of chapter.subparts) {
            if (subpart.id) {
              const { error: subpartError } = await supabase.from('elearning_subparts')
                .update({ title: subpart.title, vimeo_url: subpart.vimeoUrl || null, description_html: subpart.descriptionHtml || null, pdf_url: subpart.pdfUrl || null, pdf_name: subpart.pdfName || null, order_index: subpart.orderIndex })
                .eq('id', subpart.id)
              if (subpartError) throw subpartError
            } else {
              const { error: subpartError } = await supabase.from('elearning_subparts')
                .insert({ chapter_id: chapterId, title: subpart.title, vimeo_url: subpart.vimeoUrl || null, description_html: subpart.descriptionHtml || null, pdf_url: subpart.pdfUrl || null, pdf_name: subpart.pdfName || null, order_index: subpart.orderIndex })
              if (subpartError) throw subpartError
            }
          }
        }
      } else {
        if (formation.isFeaturedOsteoflow) {
          await supabase.from('elearning_formations')
            .update({ is_featured_osteoflow: false })
            .eq('is_featured_osteoflow', true)
        }

        const { data: formationData, error: formationError } = await supabase
          .from('elearning_formations')
          .insert({
            title: formation.title,
            description: formation.description,
            is_private: formation.isPrivate,
            is_free_access: formation.isFreeAccess,
            is_featured_osteoflow: formation.isFeaturedOsteoflow,
            photo_url: formation.photoUrl || null
          })
          .select().single()

        if (formationError) throw formationError
        formationId = formationData.id

        for (const chapter of formation.chapters) {
          const { data: chapterData, error: chapterError } = await supabase
            .from('elearning_chapters')
            .insert({ formation_id: formationId, title: chapter.title, order_index: chapter.orderIndex })
            .select().single()
          if (chapterError) throw chapterError

          if (chapter.subparts.length > 0) {
            const { error: subpartsError } = await supabase.from('elearning_subparts')
              .insert(chapter.subparts.map(s => ({ chapter_id: chapterData.id, title: s.title, vimeo_url: s.vimeoUrl || null, description_html: s.descriptionHtml || null, pdf_url: s.pdfUrl || null, pdf_name: s.pdfName || null, order_index: s.orderIndex })))
            if (subpartsError) throw subpartsError
          }
        }
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error saving course:', err)
      setError(err.message || "Une erreur est survenue lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {formation.id ? 'Modifier la formation' : 'Créer une formation'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informations générales</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la formation *</label>
              <input
                type="text"
                value={formation.title}
                onChange={(e) => setFormation({ ...formation, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Formation complète en ostéopathie"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formation.description}
                onChange={(e) => setFormation({ ...formation, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Décrivez le contenu de la formation..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo illustrative</label>
              <div className="flex flex-wrap items-center gap-3">
                {formation.photoUrl && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200">
                    <img src={formation.photoUrl} alt="Photo de la formation" className="w-full h-full object-cover" />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 cursor-pointer transition-colors border border-gray-300">
                  <Image className="w-4 h-4" />
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={isUploadingPhoto} />
                  {isUploadingPhoto ? 'Téléversement...' : formation.photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
                </label>
                {formation.photoUrl && (
                  <button type="button" onClick={() => setFormation({ ...formation, photoUrl: '' })} className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors">
                    Retirer
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <input type="checkbox" id="isPrivate" checked={formation.isPrivate}
                  onChange={(e) => setFormation({ ...formation, isPrivate: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700">Formation privée (réservée aux administrateurs)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="isFreeAccess" checked={formation.isFreeAccess}
                  onChange={(e) => setFormation({ ...formation, isFreeAccess: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" />
                <label htmlFor="isFreeAccess" className="ml-2 text-sm text-gray-700">Accessible aux utilisateurs gratuits</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="isFeaturedOsteoflow" checked={formation.isFeaturedOsteoflow}
                  onChange={(e) => setFormation({ ...formation, isFeaturedOsteoflow: e.target.checked })}
                  className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500" />
                <label htmlFor="isFeaturedOsteoflow" className="ml-2 text-sm text-gray-700">
                  <span className="font-medium text-violet-700">Mise en avant Osteoflow</span>
                  <span className="text-gray-500"> — affiché sur le dashboard praticien (1 seule à la fois)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Chapitres</h3>
              <button onClick={addChapter} className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Ajouter un chapitre
              </button>
            </div>

            {formation.chapters.length === 0 && (
              <p className="text-gray-500 text-sm italic">Aucun chapitre pour l'instant. Cliquez sur "Ajouter un chapitre" pour commencer.</p>
            )}

            {formation.chapters.map((chapter, chapterIdx) => (
              <div key={chapter.tempId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleChapter(chapter.tempId)} className="mt-1 text-gray-600 hover:text-gray-900">
                      {expandedChapters.has(chapter.tempId) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Chapitre {chapterIdx + 1}</span>
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) => updateChapter(chapter.tempId, 'title', e.target.value)}
                          placeholder="Titre du chapitre"
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveChapter(chapter.tempId, 'up')} disabled={chapterIdx === 0}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Monter le chapitre ${chapter.title || chapterIdx + 1}`}>
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => moveChapter(chapter.tempId, 'down')} disabled={chapterIdx === formation.chapters.length - 1}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Descendre le chapitre ${chapter.title || chapterIdx + 1}`}>
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        <button type="button" onClick={() => removeChapter(chapter.tempId)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">{chapter.subparts.length} sous-partie{chapter.subparts.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                {expandedChapters.has(chapter.tempId) && (
                  <div className="p-4 space-y-3 bg-white">
                    <button onClick={() => addSubpart(chapter.tempId)} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm w-full justify-center">
                      <Plus className="w-4 h-4" />
                      Ajouter une sous-partie
                    </button>

                    {chapter.subparts.map((subpart, subpartIdx) => (
                      <div key={subpart.tempId} className="border border-gray-200 rounded-md overflow-hidden">
                        <div className="bg-gray-50 p-3">
                          <div className="flex items-start gap-2">
                            <button onClick={() => toggleSubpart(subpart.tempId)} className="mt-1 text-gray-600 hover:text-gray-900">
                              {expandedSubparts.has(subpart.tempId) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">{chapterIdx + 1}.{subpartIdx + 1}</span>
                                <input
                                  type="text"
                                  value={subpart.title}
                                  onChange={(e) => updateSubpart(chapter.tempId, subpart.tempId, 'title', e.target.value)}
                                  placeholder="Titre de la sous-partie"
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={() => removeSubpart(chapter.tempId, subpart.tempId)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {expandedSubparts.has(subpart.tempId) && (
                          <div className="p-3 space-y-3 bg-white">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">URL Vimeo</label>
                              <input
                                type="text"
                                value={subpart.vimeoUrl}
                                onChange={(e) => updateSubpart(chapter.tempId, subpart.tempId, 'vimeoUrl', e.target.value)}
                                placeholder="https://vimeo.com/..."
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                              <textarea
                                value={subpart.descriptionHtml}
                                onChange={(e) => updateSubpart(chapter.tempId, subpart.tempId, 'descriptionHtml', e.target.value)}
                                rows={3}
                                placeholder="Description de la sous-partie..."
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Document PDF (optionnel)</label>
                              {subpart.pdfUrl ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <a
                                    href={subpart.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors max-w-full"
                                  >
                                    <FileText className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate max-w-[16rem]">{subpart.pdfName || 'Document PDF'}</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormation(prev => ({
                                        ...prev,
                                        chapters: prev.chapters.map(c =>
                                          c.tempId !== chapter.tempId ? c : {
                                            ...c,
                                            subparts: c.subparts.map(s =>
                                              s.tempId !== subpart.tempId ? s : { ...s, pdfUrl: '', pdfName: '' }
                                            )
                                          }
                                        )
                                      }))
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Supprimer le PDF
                                  </button>
                                </div>
                              ) : (
                                <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 cursor-pointer transition-colors border border-gray-300">
                                  <FileText className="w-4 h-4" />
                                  <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => handleSubpartPdfChange(chapter.tempId, subpart.tempId, e)}
                                    className="hidden"
                                    disabled={uploadingPdfSubpartId === subpart.tempId}
                                  />
                                  {uploadingPdfSubpartId === subpart.tempId ? 'Téléversement...' : 'Téléverser un PDF'}
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {formation.chapters.length} chapitre{formation.chapters.length !== 1 ? 's' : ''} •{' '}
            {formation.chapters.reduce((sum, c) => sum + c.subparts.length, 0)} sous-partie
            {formation.chapters.reduce((sum, c) => sum + c.subparts.length, 0) !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
              ) : (
                <><Save className="w-4 h-4" />{formation.id ? 'Enregistrer les modifications' : 'Créer la formation'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
