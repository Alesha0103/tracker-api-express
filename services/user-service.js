const UserModel = require("../models/user-model");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const mailService = require("./mail-service");
const tokenService = require("./token-service");
const UserDto = require("../dtos/user-dto");
const ApiError = require("../exeptions/api-errors");
const dayjs = require("dayjs");

class UserService {
    async registration(email, password) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest("USER_ALREADY_EXISTED");
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({
            email,
            password: hashPassword,
            activationLink,
        });
        await mailService.sendActivationMail(
            email,
            `${process.env.API_URL}/api/activate/${activationLink}`
        );

        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest("INJURED_LINK");
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email, password) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest("USER_NOT_FOUND");
        }
        const isPassEquels = await bcrypt.compare(password, user.password);
        if (!isPassEquels) {
            throw ApiError.BadRequest("E_VALIDATION_ERROR");
        }
        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async logout(refreshToken) {
        const token = tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnathorizedError();
        }
        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDB = await tokenService.findToken(refreshToken);
        if (!userData || !tokenFromDB) {
            throw ApiError.UnathorizedError();
        }
        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async getAllUsers() {
        const users = await UserModel.find();
        const updatedUsers = users.map((user) => {
            return {
                id: user.id,
                email: user.email,
                isActivated: user.isActivated,
                trackedHours: 0,
                projects: user.projects,
                isAdmin: user.isAdmin,
            };
        });
        return updatedUsers;
    }

    async editUserUser(id, updateData) {
        if (updateData.projects && Array.isArray(updateData.projects)) {
            updateData.projects = updateData.projects.map((name) => ({
                name,
                createdAt: dayjs().format("YYYY-DD-MM"),
                updatedAt: dayjs().format("YYYY-DD-MM"),
                trackedHours: 0,
            }));
        }

        const user = await UserModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            isActivated: user.isActivated,
            trackedHours: 0,
            projects: user.projects,
            isAdmin: user.isAdmin,
        };
    }

    async deleteUser(id) {
        const deletedUser = await UserModel.findByIdAndDelete(id);
        return deletedUser;
    }
}

module.exports = new UserService();
