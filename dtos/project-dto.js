module.exports = class ProjectDto {
    id;
    name;
    createdAt;
    updatedAt;
    hours;
    isDisabled;

    constructor(model) {
        this.id = model._id;
        this.name = model.name;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
        this.hours = model.hours;
        this.isDisabled = model.isDisabled;
    }
};
