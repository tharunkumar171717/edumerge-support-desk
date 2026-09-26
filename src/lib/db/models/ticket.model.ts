import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute, type Sequelize } from "sequelize";
import type { Category, Priority, Status } from "@/lib/domain/types";
import type { CategoryModel } from "./category.model";
import type { PriorityModel } from "./priority.model";
import type { UserModel } from "./user.model";

/** support_desk.tickets: one student request with its SLA clocks and optimistic-lock version. */
export class TicketModel extends Model<InferAttributes<TicketModel>, InferCreationAttributes<TicketModel>> {
  declare id: CreationOptional<number>;
  declare studentId: number;
  declare assigneeId: number | null;
  declare category: Category;
  declare subject: string;
  declare description: string;
  declare priority: Priority;
  declare status: Status;
  declare neededBy: string | null; // DATEONLY: YYYY-MM-DD
  declare createdAt: Date;
  declare updatedAt: Date;
  declare firstResponseAt: Date | null;
  declare resolvedAt: Date | null;
  declare closedAt: Date | null;
  declare slaStartAt: Date;
  declare responseDueAt: Date;
  declare resolutionDueAt: Date;
  declare pausedAt: Date | null;
  declare pausedSeconds: number;
  declare escalationLevel: number;
  declare reopenCount: number;
  declare resolutionNote: string | null;
  declare reminderSentAt: Date | null;
  declare version: number;

  declare student?: NonAttribute<UserModel>;
  declare assignee?: NonAttribute<UserModel | null>;
  declare categoryRef?: NonAttribute<CategoryModel>;
  declare priorityRef?: NonAttribute<PriorityModel>;

  static initModel(sequelize: Sequelize) {
    return TicketModel.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        studentId: { type: DataTypes.INTEGER, allowNull: false },
        assigneeId: { type: DataTypes.INTEGER },
        category: { type: DataTypes.TEXT, allowNull: false },
        subject: { type: DataTypes.TEXT, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        priority: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.TEXT, allowNull: false },
        neededBy: { type: DataTypes.DATEONLY },
        // Timestamps are set by the domain layer (it owns "now"), not by Sequelize.
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
        firstResponseAt: { type: DataTypes.DATE },
        resolvedAt: { type: DataTypes.DATE },
        closedAt: { type: DataTypes.DATE },
        slaStartAt: { type: DataTypes.DATE, allowNull: false },
        responseDueAt: { type: DataTypes.DATE, allowNull: false },
        resolutionDueAt: { type: DataTypes.DATE, allowNull: false },
        pausedAt: { type: DataTypes.DATE },
        pausedSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        escalationLevel: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
        reopenCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        resolutionNote: { type: DataTypes.TEXT },
        reminderSentAt: { type: DataTypes.DATE },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      },
      { sequelize, tableName: "tickets" },
    );
  }
}
