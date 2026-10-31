import { Router } from 'express'
import { getCurrentUser, login, logout, register, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, getCurrentUser)
router.patch('/me', requireAuth, updateProfile)

export default router
