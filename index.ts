// import the DLL for lua 5.4

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
    }
);

async function ReadError(luaState: Deno.PointerValue): Promise<string> {

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

async function RunLuaString(luaState: Deno.PointerValue, code: string): Promise<number> {

    const buffer = StringTooBuffer(code);
    // load the code into the Lua state
    let v = lua.symbols.luaL_loadstring(luaState, buffer);

    if (v != 0) {
        console.log("Error loading the Lua code!");
        console.log(await ReadError(luaState));
        return v;
    }

    await sleep(10); // wait for the code to be loaded
    v = lua.symbols.lua_pcallk(luaState, 0, -1, 0);
    return v;
}

const LuaState: Deno.PointerValue = lua.symbols.luaL_newstate(); // create a new Lua state

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
async function ReadTable(luaState: Deno.PointerValue, tableStackIndex: number): Promise<any> {
    const table = {};
    
    

}

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

            let argumentCount = lua.symbols.lua_gettop(L);
            let args = new Array<any>();

            for (let i = argumentCount; i >= 1; i--) {
                args.push(ReadValue(L, -i));
            }

            //console.log(args);

            func(...args);

            return 0;

        }
    )

    return cFunctionPointer;
}

(async () => {

    await lua.symbols.luaL_openlibs(LuaState); // open all standard libraries

    await sleep(10); // wait for the libraries to open

    //await sleep(10); // wait for the stack to be checked

    const testFunc = WrapJSFunction((...args: any[]) => {
        console.log(`lua said:`, ...args);
    })

    lua.symbols.lua_pushcclosure(LuaState, testFunc.pointer, 0); // push a closure to the stack

    //await sleep(10); // wait for the closure to be pushed

    lua.symbols.lua_setglobal(LuaState, StringTooBuffer("test").buffer); // set the global print function

    await sleep(10); // wait for the global function to be set

    Deno.readTextFile("./test.lua").then(async (code) => {

        let vm = await RunLuaString(LuaState, code); // run a simple lua code

        if (vm != 0) {
            console.log("Error running the Lua code!");
            console.log(await ReadError(LuaState));
        }

        await sleep(10); // wait for the code to be executed

        lua.symbols.lua_close(LuaState); // close the Lua state
        testFunc.close(); // release the function pointer
    })

})()