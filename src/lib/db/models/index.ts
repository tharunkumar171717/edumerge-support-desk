import type { Sequelize } from "sequelize";
import { CategoryModel } from "./category.model";
import { CommentModel } from "./comment.model";
import { NotificationModel } from "./notification.model";
import { PriorityModel } from "./priority.model";
import { TeamModel } from "./team.model";
import { TicketEventModel } from "./ticket-event.model";
import { TicketModel } from "./ticket.model";
import { UserModel } from "./user.model";

export { CategoryModel, CommentModel, NotificationModel, PriorityModel, TeamModel, TicketEventModel, TicketModel, UserModel };

/** Registers every model on the connection and declares the relations used by `include`. */
export function initModels(sequelize: Sequelize) {
  for (const m of [TeamModel, PriorityModel, CategoryModel, UserModel, TicketModel, CommentModel, TicketEventModel, NotificationModel]) {
    m.initModel(sequelize);
  }

  // Master data: codes are the keys, so relations use targetKey "code".
  CategoryModel.belongsTo(TeamModel, { as: "teamRef", foreignKey: "teamCode", targetKey: "code" });
  UserModel.belongsTo(TeamModel, { as: "teamRef", foreignKey: "team", targetKey: "code" });

  TicketModel.belongsTo(UserModel, { as: "student", foreignKey: "studentId" });
  TicketModel.belongsTo(UserModel, { as: "assignee", foreignKey: "assigneeId" });
  TicketModel.belongsTo(CategoryModel, { as: "categoryRef", foreignKey: "category", targetKey: "code" });
  TicketModel.belongsTo(PriorityModel, { as: "priorityRef", foreignKey: "priority", targetKey: "code" });

  CommentModel.belongsTo(UserModel, { as: "author", foreignKey: "authorId" });
  TicketEventModel.belongsTo(UserModel, { as: "actor", foreignKey: "actorId" });
  NotificationModel.belongsTo(TicketModel, { as: "ticket", foreignKey: "ticketId" });
}
