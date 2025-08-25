const Router = require("express");
const userController = require("../controllers/user-controller");
const { body } = require("express-validator");
const authMiddleware = require("../middlewares/auth-middleware");

const router = new Router();

router.post(
    "/registration",
    body("email").isEmail(),
    body("password").isLength({ min: 3, max: 32 }),
    userController.registration
);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.get("/activate/:link", userController.activate);
router.get("/refresh", userController.refresh);
router.post("/users", authMiddleware, userController.getUsers);
router.patch("/edit-user/:id/:_name", authMiddleware, userController.editUser);
router.delete(
    "/delete-user/:id/:_delete",
    authMiddleware,
    userController.deleteUser
);
router.patch("/tracking", authMiddleware, userController.trackingHours);
router.get("/projects", authMiddleware, userController.getProjects);
router.post("/project", authMiddleware, userController.getUserProject);

module.exports = router;
