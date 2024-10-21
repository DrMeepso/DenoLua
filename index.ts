// import the DLL for lua 5.4

// we are on 64 bit so the LUAI_MAXSTACK is 1000000
const LUAI_MAXSTACK = 1000000;
// LUA_REGISTRYINDEX is the index of the registry table!
const LUA_REGISTRYINDEX = -LUAI_MAXSTACK - 1000;

const lua = Deno.dlopen(
 
    "./lua54.dll",
    {
        "luaL_newstate": { parameters: [], result: "pointer" },
        "lua_close": { parameters: ["pointer"], result: "void" },
        "luaL_openlibs": { parameters: ["pointer"], result: "void" },
        "luaL_loadstring": { parameters: ["pointer", "buffer"], result: "i32" },
        "luaL_loadfilex": { parameters: ["pointer", "buffer", "buffer"], result: "i32" },
        "lua_pcallk": { parameters: ["pointer", "i32", "i32", "i32"], result: "i32" },
        "lua_pushcclosure": { parameters: ["pointer", "function", "i32"], result: "void" },
        "lua_setglobal": { parameters: ["pointer", "buffer"], result: "void" },
        "lua_getglobal": { parameters: ["pointer", "buffer"], result: "i32" },
        "lua_checkstack": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_iscfunction": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_gettop": { parameters: ["pointer"], result: "i32" },
        "lua_tolstring": { parameters: ["pointer", "i32", "pointer"], result: "pointer" },
        "lua_toboolean": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_tonumberx": { parameters: ["pointer", "i32", "pointer"], result: "f64" },
        "lua_type": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_next": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_pushnil": { parameters: ["pointer"], result: "void" },
        //"lua_pop": { parameters: ["pointer", "i32"], result: "void" },
        "lua_settop": { parameters: ["pointer", "i32"], result: "void" },
        "lua_pushboolean": { parameters: ["pointer", "i32"], result: "void" },
        "lua_pushnumber": { parameters: ["pointer", "f64"], result: "void" },
        "lua_pushstring": { parameters: ["pointer", "buffer"], result: "void" },
        "lua_createtable": { parameters: ["pointer", "i32", "i32"], result: "void" },
        "lua_settable": { parameters: ["pointer", "i32"], result: "void" },
        "lua_gettable": { parameters: ["pointer", "i32"], result: "void" },
        "luaL_ref": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_rawgeti": { parameters: ["pointer", "i32", "i32"], result: "void" },
        "lua_yieldk": { parameters: ["pointer", "i32", "i32"], result: "i32" },
        "lua_resume": { parameters: ["pointer", "pointer", "i32"], result: "i32" },
        "lua_newthread": { parameters: ["pointer"], result: "pointer" },
    }
);

function lua_pop(L: Deno.PointerValue, n: number) {
    lua.symbols.lua_settop(L, -n - 1);
}

function ReadError(luaState: Deno.PointerValue): string {

    const lengthBuffer = new Uint8Array(4)
    const msg = lua.symbols.lua_tolstring(luaState, -1, Deno.UnsafePointer.of(lengthBuffer));

    const errorLength = new DataView(lengthBuffer.buffer).getInt32(0, true);

    // @ts-ignore errors
    const buffer = new Deno.UnsafePointerView(msg).getArrayBuffer(errorLength, 0)

    return new TextDecoder().decode(buffer);
}

function StringTooBuffer(str: string): Uint8Array {

    let EntireBuffer = new Uint8Array(4 + str.length); // add 4 bytes for the null terminator

    // add the code to the buffer
    EntireBuffer.set(new TextEncoder().encode(str));

    // add the null terminator
    EntireBuffer.set([0], str.length);

    return EntireBuffer;

}

function RunLuaString(luaState: Deno.PointerValue, code: string): number {

    const buffer = StringTooBuffer(code);
    // load the code into the Lua state
    let v = lua.symbols.luaL_loadstring(luaState, buffer);

    if (v != 0) {
        console.log("Error loading the Lua code!");
        console.log(ReadError(luaState));
        return v;
    }

    v = lua.symbols.lua_resume(luaState, LuaThread, 0);
    return v;
}

const LuaThread: Deno.PointerValue = lua.symbols.luaL_newstate(); // create a new Lua state
const LuaState: Deno.PointerValue = lua.symbols.lua_newthread(LuaThread); // create a new Lua state

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

enum LuaType {
    LUA_TNONE = -1,
    LUA_TNIL = 0,
    LUA_TBOOLEAN = 1,
    LUA_TLIGHTUSERDATA = 2,
    LUA_TNUMBER = 3,
    LUA_TSTRING = 4,
    LUA_TTABLE = 5,
    LUA_TFUNCTION = 6,
    LUA_TUSERDATA = 7,
    LUA_TTHREAD = 8,
}

function WrapLuaFunction(funcRef: number)
{
    return (...args: any[]) => {
        lua.symbols.lua_rawgeti(LuaState, LUA_REGISTRYINDEX, funcRef);
        for (let i = 0; i < args.length; i++) {
            WriteValue(LuaState, args[i]);
        }
        const result = lua.symbols.lua_pcallk(LuaState, args.length, -1, 0);
        if (result != 0) {
            console.error(ReadError(LuaState));
        }
        return ReadValue(LuaState, -1);
    }
}

function ReadValue(L: Deno.PointerValue, stackIndex: number): any {

    const argType = lua.symbols.lua_type(L, stackIndex);
    switch (argType) {
        case LuaType.LUA_TNIL: { // LUA_TNIL
            return null;
        }
        case LuaType.LUA_TBOOLEAN: { // LUA_TBOOLEAN
            const value = lua.symbols.lua_toboolean(L, stackIndex);
            return value != 0
        }
        case LuaType.LUA_TNUMBER: { // LUA_TNUMBER
            return lua.symbols.lua_tonumberx(L, stackIndex, null)
        }
        case LuaType.LUA_TSTRING: { // LUA_TSTRING
            const lengthBuffer = new Uint8Array(4)
            const msg = lua.symbols.lua_tolstring(L, stackIndex, Deno.UnsafePointer.of(lengthBuffer));
            const length = new DataView(lengthBuffer.buffer).getInt32(0, true);
            // @ts-ignore errors
            const buffer = new Deno.UnsafePointerView(msg).getArrayBuffer(length, 0);
            return new TextDecoder().decode(buffer)
        }
        case LuaType.LUA_TTABLE: { // LUA_TTABLE
            return ReadTable(L, stackIndex);
        }
        case LuaType.LUA_TFUNCTION: { // LUA_TFUNCTION
        
            // make a reference to the function
            const ref = lua.symbols.luaL_ref(L, LUA_REGISTRYINDEX);
            return WrapLuaFunction(ref);

        }
        break;
        default: {
            // get the name of the type
            const typeName = LuaType[argType];
            console.log(`Unknown type: ${typeName}`);
            return null;
        }
    }

}

// read the table at the top of the stack and return it as a JavaScript object
function ReadTable(L: Deno.PointerValue, tableStackIndex: number): any {
    const table: any = {};
    const luaArray = new Array<any>();

    let isArray = false
    let hasStartedWithTable = false;

    // push nil to start the iteration
    lua.symbols.lua_pushnil(L);

    // iterate over the table
    let v = lua.symbols.lua_next(L, tableStackIndex);
    while (v != 0) {

        let top = lua.symbols.lua_gettop(L);
        let keyType = lua.symbols.lua_type(L, top - 1);
        // get the key
        // make sure the key is a string

        if (keyType == LuaType.LUA_TSTRING) {
            hasStartedWithTable = true;
        }

        if (keyType == LuaType.LUA_TNUMBER && !hasStartedWithTable) {
            isArray = true;
        }

        if (isArray && keyType != LuaType.LUA_TNUMBER) {
            console.error("Node Error: Incorrectly assumed table is an array!");
            console.error(`Try not to use numbers as keys in the table!`);
        }

        if (keyType != LuaType.LUA_TSTRING && keyType != LuaType.LUA_TNUMBER) {
            console.error("Invalid key type in table");
            console.error(`Key type: ${LuaType[lua.symbols.lua_type(L, -2)]}, expected string!`);
            return null;
        }

        const key = ReadValue(L, top - 1);
        const value = ReadValue(L, top);

        if (isArray) {
            luaArray[Number(key) - 1] = value;
        } else {
            table[key] = value;
        }
        // remove the value, leaving the key on the stack
        lua_pop(L, 1);

        v = lua.symbols.lua_next(L, tableStackIndex);
    }
  
    if (isArray) {
        return luaArray;
    } else {
        return table;
    }
  
}

function WriteValue(L: Deno.PointerValue, value: any) {

    if (value == null) {
        lua.symbols.lua_pushnil(L);
    } else if (typeof value == "boolean") {
        lua.symbols.lua_pushboolean(L, value ? 1 : 0);
    } else if (typeof value == "number") {
        lua.symbols.lua_pushnumber(L, value);
    } else if (typeof value == "string") {
        lua.symbols.lua_pushstring(L, StringTooBuffer(value).buffer);
    } else if (Array.isArray(value)) {
        lua.symbols.lua_createtable(L, value.length, 0);
        for (let i = 0; i < value.length; i++) {
            lua.symbols.lua_pushnumber(L, i + 1);
            WriteValue(L, value[i]);
            lua.symbols.lua_settable(L, -3);
        }
    } else if (typeof value == "object") {
        lua.symbols.lua_createtable(L, 0, Object.keys(value).length);
        for (let key in value) {
            lua.symbols.lua_pushstring(L, StringTooBuffer(key).buffer);
            WriteValue(L, value[key]);
            lua.symbols.lua_settable(L, -3);
        }
    } else if (typeof value == "function") {
        // wrap the function in a closure
        const func = WrapJSFunction(value);
        lua.symbols.lua_pushcclosure(L, func.pointer, 0);

    } else {
        console.error(`Unsupported type: ${typeof value}`);
    }

}

type LuaFunction = Deno.UnsafeCallback<{
    readonly parameters: readonly ["pointer"];
    readonly result: "i32";
}>

function WrapJSFunction(func: Function): Deno.UnsafeCallback<{
    readonly parameters: readonly ["pointer"];
    readonly result: "i32";
}>
{

    const cFunctionPointer = new Deno.UnsafeCallback(
        {
            parameters: ["pointer"],
            result: "i32"
        } as const,
        // L is the lua state
        (L: Deno.PointerValue) => {

            const argumentCount = lua.symbols.lua_gettop(L);
            const args = new Array<any>();

            for (let i = 1; i <= argumentCount; i++) {
                args.push(ReadValue(L, i));
            }

            const valueReturn = func(...args);

            WriteValue(L, valueReturn);
            return 1;

        }
    )

    return cFunctionPointer;
}

function pushWrapedFunctionToGlobal(L: Deno.PointerValue, func: LuaFunction, name: string) {
    lua.symbols.lua_pushcclosure(L, func.pointer, 0); // push a closure to the stack
    lua.symbols.lua_setglobal(L, StringTooBuffer(name).buffer); // set the global print function
}

async function pushObjectToGlobal(L: Deno.PointerValue, obj: any, name: string) {
    await WriteValue(L, obj);
    await lua.symbols.lua_setglobal(L, StringTooBuffer(name).buffer);
}

(async () => {

    await lua.symbols.luaL_openlibs(LuaState); // open all standard libraries

    await sleep(10); // wait for the libraries to open

    //await sleep(10); // wait for the stack to be checked

    const sin = WrapJSFunction((f: Function) => {
       let v = f("baller", true);
    })
    pushWrapedFunctionToGlobal(LuaState, sin, "sin");

    const print = WrapJSFunction((...args: any[]) => {
        console.log(`Lua >`, ...args);
    })
    pushWrapedFunctionToGlobal(LuaState, print, "print");

    const pause = WrapJSFunction(async () => {
        await sleep(1000);

        console.log("Unpaused!");

        return 0;
    })

    pushWrapedFunctionToGlobal(LuaState, pause, "pause");

    let testObject = {
        name: "baller",
        age: 20,
        isCool: true,
        isNotCool: false,
        testArray: [1, 2, 3, 4, 5],
        func: () => {
            return {
                add: (a: number, b: number) => { return a + b; },
                sub: (a: number, b: number) => { return a - b; },
            }
        }
    }

    await pushObjectToGlobal(LuaState, testObject, "testObject");

    await sleep(100); // wait for the global function to be set

    Deno.readTextFile("./test.lua").then(async (code) => {

        let vm = RunLuaString(LuaState, code); // run a simple lua code

        console.log("VM: ", vm);

        if (vm != 0) {
            console.log("Error running the Lua code!");
            console.log(ReadError(LuaState));
        }

        await sleep(10); // wait for the code to be executed

        lua.symbols.lua_close(LuaState); // close the Lua state

        print.close();
        sin.close();
    })

})()