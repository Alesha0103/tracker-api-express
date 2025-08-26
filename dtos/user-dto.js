const ProjectDto = require("./project-dto");
module.exports = class UserDto {
    email;
    id;
    isActivated;
    isAdmin;
    totalHours;
    projects;

    constructor(model) {
        this.email = model.email;
        this.id = model._id;
        this.isActivated = model.isActivated;
        this.isAdmin = model.isAdmin;
        this.totalHours = model.totalHours;
        this.projects = model.projects.map((p) => new ProjectDto(p));
    }
};
