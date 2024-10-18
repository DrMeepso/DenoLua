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

-- sin is a javascript function
-- the javascript function calls the lua function
-- and then the lua function returns a value
-- and the javascript function reads that value
sin(function(a, b)
    print(a)
    return true == b
end)