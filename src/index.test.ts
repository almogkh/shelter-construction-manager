import { describe, it, expect, vi, afterEach } from 'vitest';
import { apartments, itemsInApartment, scheduleItems } from '$lib/db/schema';
import { currentApartmentsInSchedItem, newApartmentsInSchedItem, teamSchedule, teamScheduleResult, toCollectItems } from './testdata';
import { handle } from './hooks.server';

const { insert, values, select, from, where, innerJoin, orderBy, eq, deleteFn, and, update, set } = vi.hoisted(() => {
    const insert = vi.fn();
    const values = vi.fn();
    const select = vi.fn();
    const from = vi.fn();
    const where = vi.fn();
    const innerJoin = vi.fn();
    const orderBy = vi.fn();
    const eq = vi.fn();
    const deleteFn = vi.fn();
    const and = vi.fn();
    const update = vi.fn();
    const set = vi.fn();

    return { insert, values, select, from, where, innerJoin, orderBy, eq, deleteFn, and, update, set };
});

vi.mock('drizzle-orm/node-postgres', () => {
    const drizzle = vi.fn();

    const db = { insert, select, delete: deleteFn, update };
    drizzle.mockReturnValue(db);
    insert.mockReturnValue({ values });
    select.mockReturnValue({ from });
    from.mockReturnValue({ where });
    where.mockReturnValue({ innerJoin, orderBy });
    innerJoin.mockReturnValue({ innerJoin, orderBy });
    deleteFn.mockReturnValue({ where });
    orderBy.mockReturnValue({ innerJoin });
    update.mockReturnValue({ set });
    set.mockReturnValue({ where });

    return { drizzle };
});

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, eq, and };
});

describe('DB tests', async () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const { getTeamSchedule, collectScheduleItems, addApartment, updateSchedule } = await vi.importActual('$lib/db/db.server') as any;

    it('addApartment', async () => {
        where.mockResolvedValueOnce([{ id: 1 }]);
        const apartment = { number: 1, contractid: 1, floor: 1, doorWidth: 5, doorHeight: 5 };
        await addApartment(apartment);

        expect(insert).toBeCalledTimes(2);
        expect(insert).toBeCalledWith(apartments);
        expect(insert).toBeCalledWith(itemsInApartment);

        expect(values).toBeCalledTimes(2);
        expect(values).toBeCalledWith({ number: apartment.number, floor: apartment.floor, contractid: apartment.contractid,
                                        quantity: 1, itemid: 1
         });
        expect(values).toBeCalledWith(apartment);
    });

    it('getTeamSchedule', async () => {
        innerJoin.mockImplementation(() => {
            return {
                innerJoin, orderBy,
                then(onFulfilled: any) {
                    onFulfilled(teamSchedule);
                }
            };
        });
        const res = await getTeamSchedule(1);

        expect(res).toEqual(teamScheduleResult);
    });

    it('collectScheduleItems', async () => {
        innerJoin.mockImplementation(() => {
            return {
                innerJoin, orderBy,
                then(onFulfilled: any) {
                    onFulfilled(toCollectItems);
                }
            };
        });

        await collectScheduleItems(1);

        expect(deleteFn).toBeCalledTimes(2);
        expect(eq.mock.calls).toContainEqual([scheduleItems.id, 1]);
        expect(eq.mock.calls).toContainEqual([scheduleItems.id, 3]);
    });

    it('updateSchedule', async () => {
        where.mockImplementationOnce(() => {});
        where.mockImplementationOnce(() => {
            return {
                then(onFulfilled: any) {
                    onFulfilled(currentApartmentsInSchedItem);
                },
            };
        });

        await updateSchedule({ contractid: 1, apartments: newApartmentsInSchedItem } as any, 1);

        expect(insert).toBeCalledTimes(1);
        expect(deleteFn).toBeCalledTimes(2);
    });
});

const { getUserSession, error, redirect, resolve } = vi.hoisted(() => {
    const getUserSession = vi.fn();
    const error = vi.fn();
    const redirect = vi.fn();
    const resolve = vi.fn();

    return { getUserSession, error, redirect, resolve };
});

vi.mock('$lib/db/db.server', () => {
    return { getUserSession };
});

vi.mock('@sveltejs/kit', () => {
    redirect.mockImplementation(() => {
        throw new Error();
    });

    error.mockImplementation(() => {
        throw new Error();
    });

    return { error, redirect };
});

describe('Main server \'handle\' hook', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('login', async () => {
        const event = {
            url: { pathname: '/login' },
            locals: { user: null },
        };
        await handle({ event, resolve });

        expect(resolve).toBeCalledTimes(1);
    });

    it('login redirect', async () => {
        const event = {
            locals: { user: null },
            url: { pathname: '/' },
            cookies: { get() { return ''; } },
        };

        try {
            await handle({ event, resolve });
        } catch (e: any) {}

        expect(redirect).toBeCalledTimes(1);
        expect(redirect).toBeCalledWith(303, '/login');
    });

    it('unknown route', async () => {
        const event = {
            locals: { user: null },
            url: { pathname: '/asdf' },
            cookies: { get() { return 'session'; } },
        };
        getUserSession.mockReturnValueOnce('user');

        try {
            await handle({ event, resolve });
        } catch (e: any) {}

        expect(error).toBeCalledTimes(1);
        expect(error).toBeCalledWith(404);
    });

    it('no permissions', async () => {
        const event = {
            locals: { user: null },
            url: { pathname: '/employees' },
            cookies: { get() { return 'session'; } },
        };
        getUserSession.mockReturnValueOnce({ password: '', role: 'teamlead' });

        try {
            await handle({ event, resolve });
        } catch (e: any) {}

        expect(error).toBeCalledTimes(1);
        expect(error).toBeCalledWith(403);
    });
});
