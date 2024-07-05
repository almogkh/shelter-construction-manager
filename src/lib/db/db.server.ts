import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { sql as vercelSql } from "@vercel/postgres";
import Pg from "pg";
import * as schema from "./schema";
import { items, itemsInApartment, apartmentInScheduleItem, apartments, users,
    sessions, type Item, type User, type Apartment, type ScheduleItem, teams, scheduleItems, contracts } from "./schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { NODE_DB, POSTGRES_URL } from "$env/static/private";

const { Pool } = Pg;
export const db = NODE_DB
                    ? drizzleNode(new Pool({connectionString: POSTGRES_URL}))
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

export async function getTeam(teamid: number) {
    const team = (await db.select().from(teams).where(eq(teams.id, teamid)))[0];
    return team;
}

export async function getTeamSchedule(teamid: number) {
    const rows = await db.select().from(scheduleItems).where(and(eq(scheduleItems.teamid, teamid), eq(scheduleItems.status, 'pending')))
                    .innerJoin(apartmentInScheduleItem, eq(apartmentInScheduleItem.itemid, scheduleItems.id))
                    .innerJoin(apartments, and(
                            eq(apartments.contractid, apartmentInScheduleItem.contractid),
                            eq(apartments.floor, apartmentInScheduleItem.floor),
                            eq(apartments.number, apartmentInScheduleItem.number)
                    ))
                    .innerJoin(itemsInApartment, and(
                            eq(apartments.contractid, itemsInApartment.contractid),
                            eq(apartments.floor, itemsInApartment.floor),
                            eq(apartments.number, itemsInApartment.number)
                    ))
                    .innerJoin(items, eq(items.id, itemsInApartment.itemid));

    type ApartmentWithItems = (Apartment & {items: Item[]});
    const result = rows.reduce<Record<number, {item: ScheduleItem, apartments: ApartmentWithItems[]}>>((acc, row) => {
        const item = row.scheduleItems;
        const apartment = row.apartments;

        if (!acc[item.id]) {
            acc[item.id] = {item, apartments: []};
        }

        let apt = acc[item.id].apartments.find((value) => value.floor === apartment.floor && value.number === apartment.number);
        if (!apt) {
            apt = {...apartment, items: []};
            acc[item.id].apartments.push(apt);
        }

        row.items.quantity = row.itemsInApartment.quantity;
        apt.items.push(row.items);

        return acc;
    }, {});

    return result;
}

export async function markSchedItemComplete(id: number) {
    await db.update(scheduleItems).set({status: 'complete'}).where(eq(scheduleItems.id, id));
}

export async function markApartmentComplete(contractid: number, floor: number, number: number) {
    await db.update(apartments).set({status: 'complete'}).where(and(
        eq(apartments.contractid, contractid),
        eq(apartments.floor, floor),
        eq(apartments.number, number)
    ));
}

export async function getContractById(id: number) {
    const contract = (await db.select().from(contracts).where(eq(contracts.id, id)))[0];
    return contract;
}
