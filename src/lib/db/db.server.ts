import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { sql as vercelSql } from "@vercel/postgres";
import Pg from "pg";
import * as schema from "./schema";
import { users, sessions, type User, teams } from "./schema";
import { and, eq, lt, sql } from "drizzle-orm";

const { Pool } = Pg;
export const db = process.env.NODE_DB
                    ? drizzleNode(new Pool({connectionString: process.env.POSTGRES_URL}))
                    : drizzleVercel(vercelSql, {schema});

export async function getUserSession(sessionid: string) {
    const session = db.select().from(sessions).where(and(eq(sessions.sessionid, sessionid), lt(sql`now()`, sessions.expirationTime))).as('session');
    const result = await db.select().from(users).rightJoin(session, eq(session.userid, users.id));
    if (result.length === 0)
        return null;
    return result[0].users;
}

export async function addNewUser(newUser: typeof users.$inferInsert) {
    const userid = (await db.insert(users).values(newUser).returning())[0].id;
    return userid;
}

export async function updateUser(userid: number, data: Partial<User>) {
    await db.update(users).set(data).where(eq(users.id, userid));
}

export async function deleteUser(userid: number) {
    await db.delete(users).where(eq(users.id, userid));
    
}

export async function getEmployeeList() {
    const employees = await db.select().from(users);
    return employees;
}

export async function getEmployeeTeams(user: User) {
    const teamList = await db.select().from(teams).where(eq(teams.lead, user.id));
    return teamList;
}
