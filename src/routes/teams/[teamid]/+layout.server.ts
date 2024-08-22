import { collectScheduleItems, getTeam, getTeamSchedule } from "$lib/db/db.server";

export async function load(event) {
    const teamid = parseInt(event.params.teamid);
    const team = await getTeam(teamid);
    const schedule = await getTeamSchedule(teamid);
    await collectScheduleItems(teamid);

    return {
        team,
        schedule,
    };
}
