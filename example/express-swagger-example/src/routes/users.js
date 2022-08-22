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

/**
 * Lấy thông tin chi tiết của User
 * @summary Lấy thông tin chi tiết của User
 * @model getUserDetails
 * @route get /:userId
 * @security [{ "Bearer": ["ADMIN"] }]
 */
router.get('/:userId', userController.getUserDetails);

/**
 * Xóa User
 * @summary Xóa người dùng
 * @model deleteUser
 * @route delete /:userId/:path1/:path2
 * @security [{ "Bearer": ["ADMIN"] }]
 */
router.delete('/:userId/:path1/:path2', userController.deleteUser);


module.exports = router;
