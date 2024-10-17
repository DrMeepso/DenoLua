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
test("hello", nil, false, math.pi, testTable)