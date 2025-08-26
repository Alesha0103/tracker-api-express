module.exports = class StatDto {
    id;
    date;
    hours;
    comment;

    constructor(model) {
        this.id = model._id;
        this.date = model.date;
        this.hours = model.hours;
        this.comment = model.comment;
    }
};
