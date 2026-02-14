import  supabase  from "../lib/supabaseClient";

export async function SignUpInfo(UserId, username, role) {
    try {
        const { error: InsertError } = await supabase.from("profiles").insert([
            {
                id: UserId,
                username: username,
                role: role,
            },
        ]);

        if (InsertError) {
            console.error("Inserting info failed:", InsertError.message);
        } else {
            console.log("Profile created successfully!");
        } 
    } catch (error) {
        console.error("unexpected error;", error.message);
    }
}