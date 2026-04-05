const express = require('express');
const reservasController = require('../controllers/reservas.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin_general', 'admin_conjunto', 'condomino'), reservasController.list);
router.get('/:id', authenticateToken, authorizeRoles('admin_general', 'admin_conjunto', 'condomino'), reservasController.getById);
router.post('/', authenticateToken, authorizeRoles('admin_general', 'admin_conjunto', 'condomino'), reservasController.create);
router.put('/:id', authenticateToken, authorizeRoles('admin_general', 'admin_conjunto', 'condomino'), reservasController.update);
router.delete('/:id', authenticateToken, authorizeRoles('admin_general', 'admin_conjunto', 'condomino'), reservasController.remove);

module.exports = router;
