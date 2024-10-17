// import the DLL for lua 5.4

const lua = Deno.dlopen(
    "./lua54.dll",
    {
        "luaL_newstate": { parameters: [], result: "pointer" },
        "lua_close": { parameters: ["pointer"], result: "void" },
        "luaL_openlibs": { parameters: ["pointer"], result: "void" },
        "luaL_loadstring": { parameters: ["pointer", "buffer"], result: "i32" },
        "lua_pcallk": { parameters: ["pointer", "i32", "i32", "i32"], result: "i32" },
        "lua_pushcclosure": { parameters: ["pointer", "function", "i32"], result: "void" },
        "lua_setglobal": { parameters: ["pointer", "buffer"], result: "void" },
        "lua_getglobal": { parameters: ["pointer", "buffer"], result: "i32" },
        "lua_checkstack": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_iscfunction": { parameters: ["pointer", "i32"], result: "i32" },
        "lua_gettop": { parameters: ["pointer"], result: "i32" },
        "lua_tolstring": { parameters: ["pointer", "i32", "pointer"], result: "pointer" }
    }
);

function RunLuaString(luaState: Deno.PointerValue, code: string): number {
    // get a char buffer from the code (signed 8 bit integer array)
    let v = lua.symbols.luaL_loadstring(luaState, new TextEncoder().encode(code).buffer);
    v = lua.symbols.lua_pcallk(luaState, 0, -1, 0);
    return v;
}

const LuaState: Deno.PointerValue = lua.symbols.luaL_newstate(); // create a new Lua state

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {

    lua.symbols.luaL_openlibs(LuaState); // open all standard libraries

    await sleep(10); // wait for the libraries to open

    const cFunctionPointer = new Deno.UnsafeCallback(
        {
            parameters: ["pointer"],
            result: "i32"
        } as const,
        (p: Deno.PointerValue) => {
            console.log("Hello from Lua!");
            return 0;
        }
    )

    const stack = lua.symbols.lua_checkstack(LuaState, 1); // check if the stack has enough space
    if (stack == 0) {
        console.log("Stack overflow!");
        Deno.exit(1);
    } else { console.log("Stack has enough space!") }

    //await sleep(10); // wait for the stack to be checked

    lua.symbols.lua_pushcclosure(LuaState, cFunctionPointer.pointer, 0); // push a closure to the stack

    //await sleep(10); // wait for the closure to be pushed

    lua.symbols.lua_setglobal(LuaState, new TextEncoder().encode("test").buffer); // set the global print function

    //await sleep(10); // wait for the global function to be set

    Deno.readTextFile("./test.lua").then((code) => {
        let vm = RunLuaString(LuaState, code); // run a simple lua code
        console.log(`Program exited with code ${vm}`);

        if (vm != 0) {
            console.log("Error running the Lua code!");
            // create a pointer to get the string length
            const lengthBuffer = new Uint8Array(4)
            const msg = lua.symbols.lua_tolstring(LuaState, -1, Deno.UnsafePointer.of(lengthBuffer));

            const errorLength = new DataView(lengthBuffer.buffer).getInt32(0, true);
            console.log(`String length: ${errorLength}`);

            // @ts-ignore errors
            const buffer = new Deno.UnsafePointerView(msg).getArrayBuffer(errorLength, 0)
            
            console.log(`Lua error message: ${new TextDecoder().decode(buffer)}`);
        }

        lua.symbols.lua_close(LuaState); // close the Lua state
        cFunctionPointer.close(); // release the closure

    })

})()