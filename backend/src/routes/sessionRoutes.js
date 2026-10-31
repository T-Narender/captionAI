import { Router } from 'express'
import { createSession, deleteSession, endSession, getRecentTranscripts, getSessionById, getSessions, updateSessionTitle } from '../controllers/sessionController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)
router.post('/', createSession)
router.get('/', getSessions)
router.get('/recent-transcripts', getRecentTranscripts)
router.patch('/:id', updateSessionTitle)
router.delete('/:id', deleteSession)
router.get('/:id', getSessionById)
router.post('/:id/end', endSession)

export default router
