print("Lua in Deno")
local testTable = {
    ["string"] = "yeah",
    ["baller"] = nil,
    ["isTrue"] = false,
    ["pi"] = math.pi,
    ["table"] = {
        "hello", "world"
    }
}
print("hello", nil, false, math.pi, testTable)
print(sin(12)() == math.sin(12))