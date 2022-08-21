'use strict';
var express = require('express');
var router = express.Router();
var { validation } = require('expressjs-swagger-generator');
var userController = require('../controller/user');
var requestModel = require('../requestModel/users');

/**
 * API này dùng để tạo mới người dùng
 * @summary Tạo mới người dùng
 * @model createUser
 * @route POST /
 */
router.post('/', validation(requestModel.createUser), userController.createUser);

/**
 * @model getUsers
 * @route GET /
 */
router.get('/', userController.getUsers);

/**
 * Cập nhật thông tin người dùng
 * @summary Cập nhật thông tin người dùng
 * @model updateUser
 * @route PUT /:userId
 * @security [{ "Bearer": ["ADMIN"] }]
 */
router.put('/:userId', userController.updateUser);

router.get('/:userId', userController.getUserDetails);

router.delete('/:userId', userController.deleteUser);


module.exports = router;
